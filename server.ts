import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import {
  AssetClassification,
  FullTickerEvaluation,
  ScanRunLog,
  SignalSnapshot,
  WatchlistItem,
} from './src/types/v8';
import {
  INITIAL_HISTORICAL_SIGNALS,
  INITIAL_SCAN_RUNS,
  INITIAL_WATCHLIST_RAW,
  runV8PipelineOnSeedData,
} from './src/data/initialData';
import { calculateBacktestMetrics } from './src/engine/backtestEngine';
import {
  createSignalSnapshot,
  formatTelegramNotification,
  shouldGenerateSignal,
} from './src/engine/signalEngine';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // In-memory persistent state during server runtime
  let manualClassifications: Record<string, AssetClassification> = {};
  let watchlistStore: WatchlistItem[] = [];
  let signalSnapshotsStore: SignalSnapshot[] = [...INITIAL_HISTORICAL_SIGNALS];
  let scanRunsStore: ScanRunLog[] = [...INITIAL_SCAN_RUNS];
  let currentEvaluations: FullTickerEvaluation[] = [];

  // Initialize pipeline
  const initialResult = runV8PipelineOnSeedData(manualClassifications);
  currentEvaluations = initialResult.evaluations;
  watchlistStore = initialResult.watchlist;

  // 1. Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', version: 'V8.0-engine' });
  });

  // 2. Full Live Evaluations (Section 5: All Watchlist items evaluated!)
  app.get('/api/v8/evaluations', (req, res) => {
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      count: currentEvaluations.length,
      evaluations: currentEvaluations,
    });
  });

  // 3. Watchlist CRUD
  app.get('/api/v8/watchlist', (req, res) => {
    res.json({ success: true, watchlist: watchlistStore });
  });

  app.post('/api/v8/watchlist', (req, res) => {
    const { ticker, name, memo } = req.body;
    if (!ticker) {
      return res.status(400).json({ error: 'Ticker is required' });
    }
    const cleanTicker = ticker.toUpperCase().trim();
    if (watchlistStore.some((w) => w.ticker === cleanTicker)) {
      return res.status(400).json({ error: 'Ticker already exists in watchlist' });
    }

    const newItem: WatchlistItem = {
      ticker: cleanTicker,
      name: name || cleanTicker,
      is_active: true,
      memo: memo || '사용자 추가 종목',
      created_at: new Date().toISOString(),
    };
    watchlistStore.push(newItem);

    // Re-run pipeline to incorporate new item
    const refreshed = runV8PipelineOnSeedData(manualClassifications);
    currentEvaluations = refreshed.evaluations;

    res.json({ success: true, item: newItem });
  });

  app.patch('/api/v8/watchlist/:ticker', (req, res) => {
    const ticker = req.params.ticker.toUpperCase();
    const { is_active, memo } = req.body;
    const item = watchlistStore.find((w) => w.ticker === ticker);
    if (!item) {
      return res.status(404).json({ error: 'Ticker not found' });
    }
    if (typeof is_active === 'boolean') item.is_active = is_active;
    if (typeof memo === 'string') item.memo = memo;

    res.json({ success: true, item });
  });

  app.delete('/api/v8/watchlist/:ticker', (req, res) => {
    const ticker = req.params.ticker.toUpperCase();
    watchlistStore = watchlistStore.filter((w) => w.ticker !== ticker);
    currentEvaluations = currentEvaluations.filter((e) => e.ticker !== ticker);
    res.json({ success: true, message: `Removed ${ticker}` });
  });

  // 4. Classification Manual Override (Section 13.4: Manual Override protection)
  app.post('/api/v8/classification/override', (req, res) => {
    const { ticker, asset_type, strategy_type, confidence, reason } = req.body;
    if (!ticker || !strategy_type) {
      return res.status(400).json({ error: 'Ticker and strategy_type required' });
    }
    const cleanTicker = ticker.toUpperCase();
    const override: AssetClassification = {
      ticker: cleanTicker,
      asset_type: asset_type || 'equity',
      strategy_type,
      confidence: confidence ?? 1.0,
      classification_source: 'manual',
      reason: reason || '관리자 수동 지정 (Manual Override)',
      classified_at: manualClassifications[cleanTicker]?.classified_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    manualClassifications[cleanTicker] = override;

    // Re-evaluate
    const refreshed = runV8PipelineOnSeedData(manualClassifications);
    currentEvaluations = refreshed.evaluations;

    res.json({ success: true, classification: override });
  });

  // Reset manual override back to auto
  app.delete('/api/v8/classification/override/:ticker', (req, res) => {
    const cleanTicker = req.params.ticker.toUpperCase();
    delete manualClassifications[cleanTicker];
    const refreshed = runV8PipelineOnSeedData(manualClassifications);
    currentEvaluations = refreshed.evaluations;
    res.json({ success: true, message: `Reset ${cleanTicker} to auto classification` });
  });

  // 5. Scan Execution (Section 14: Partial Failure Tolerance, Section 15: Run History)
  app.post('/api/v8/scan/run', (req, res) => {
    const simulatePartialFailure = req.body.simulate_partial_failure === true;
    const startTime = new Date();
    const runId = `run-${Date.now()}`;

    // Execute V8 pipeline across all watchlist items
    const refreshed = runV8PipelineOnSeedData(manualClassifications);
    currentEvaluations = refreshed.evaluations;

    let failedList: { ticker: string; error: string }[] = [];
    let evaluatedCount = currentEvaluations.length;

    if (simulatePartialFailure && currentEvaluations.length > 0) {
      // Simulate 1 ticker failure to demonstrate graceful resilience
      const failTarget = currentEvaluations[currentEvaluations.length - 1].ticker;
      failedList.push({
        ticker: failTarget,
        error: 'Simulated quote API timeout (Gracefully logged and skipped)',
      });
      evaluatedCount -= 1;
    }

    // Check newly actionable signals
    const newSignals: SignalSnapshot[] = [];
    currentEvaluations.forEach((evalItem) => {
      if (shouldGenerateSignal(evalItem, signalSnapshotsStore)) {
        const snap = createSignalSnapshot(evalItem);
        newSignals.push(snap);
        signalSnapshotsStore.unshift(snap); // Append snapshot to immutable signal ledger
      }
    });

    const finishTime = new Date();
    const scanLog: ScanRunLog = {
      run_id: runId,
      started_at: startTime.toISOString(),
      finished_at: finishTime.toISOString(),
      watchlist_count: watchlistStore.length,
      evaluated_count: evaluatedCount,
      signal_count: newSignals.length,
      failure_count: failedList.length,
      failed_tickers: failedList,
      status: failedList.length > 0 ? 'PARTIAL_SUCCESS' : 'SUCCESS',
      version: 'V8.0',
      error_summary:
        failedList.length > 0 ? `${failedList.length}건 API 실패 발생했으나 전체 스캔 지속 완료` : undefined,
    };

    scanRunsStore.unshift(scanLog);

    res.json({
      success: true,
      scan_log: scanLog,
      new_signals: newSignals,
      evaluations_count: currentEvaluations.length,
    });
  });

  // 6. Signals Ledger (Section 9: Snapshot Preservation)
  app.get('/api/v8/signals', (req, res) => {
    const version = req.query.version as string;
    let list = signalSnapshotsStore;
    if (version) {
      list = list.filter((s) => s.score_version === version);
    }
    res.json({ success: true, signals: list });
  });

  // 7. Backtest Comparison (Section 17 & 18: V7 vs V8)
  app.get('/api/v8/backtest', (req, res) => {
    const v8Summary = calculateBacktestMetrics(signalSnapshotsStore, 'V8.0');
    const v7Summary = calculateBacktestMetrics(signalSnapshotsStore, 'V7.0');

    res.json({
      success: true,
      v8: v8Summary,
      v7: v7Summary,
      all_signals: signalSnapshotsStore,
    });
  });

  // 8. Scan Runs History
  app.get('/api/v8/runs', (req, res) => {
    res.json({ success: true, runs: scanRunsStore });
  });

  // 9. Telegram Preview (Section 12: Action-Oriented Telegram Payload)
  app.post('/api/v8/telegram/preview', (req, res) => {
    const { ticker } = req.body;
    if (!ticker) {
      return res.status(400).json({ error: 'Ticker is required' });
    }
    const evalItem = currentEvaluations.find((e) => e.ticker === ticker.toUpperCase());
    if (!evalItem) {
      return res.status(404).json({ error: 'Ticker evaluation not found' });
    }
    const snapshot = createSignalSnapshot(evalItem);
    const message = formatTelegramNotification(snapshot);

    res.json({
      success: true,
      ticker: evalItem.ticker,
      message,
      snapshot,
    });
  });

  // Vite middleware for development vs static in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`V8 Quant System Server running on http://localhost:${PORT}`);
  });
}

startServer();
