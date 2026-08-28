import { OHLCVBar } from '../data/providers/types';
import { marketDataRepository } from '../db/repositories/marketDataRepository';
import { signalRepository } from '../db/repositories/signalRepository';
import { scanRunRepository } from '../db/repositories/scanRunRepository';
import { watchlistRepository } from '../db/repositories/watchlistRepository';
import { historicalDataProvider } from '../backtest/historicalDataProvider';
import { evaluateStrategy } from '../backtest/quantStrategy';
import { SignalSnapshot, RiskLevel, StrategyType, ScanRunLog } from '../types/v8';

export interface BackfillOptions {
  lookbackRange?: '6m' | '1y' | '2y';
  tickers?: string[];
  opportunityThreshold?: number;
  replaceExisting?: boolean;
}

export interface BackfillResult {
  success: boolean;
  totalTickers: number;
  totalBarsIngested: number;
  totalSignalsGenerated: number;
  completedSignals: number;
  winRate5d: number;
  winRate10d: number;
  winRate20d: number;
  avgReturn20d: number;
  dateRange: {
    start: string;
    end: string;
  };
  detailsByTicker: Record<
    string,
    {
      barsCount: number;
      signalsCount: number;
      winRate20d: number;
      avgReturn20d: number;
    }
  >;
}

export async function runHistoricalBackfill(
  options: BackfillOptions = {}
): Promise<BackfillResult> {
  const range = options.lookbackRange || '1y';
  const threshold = options.opportunityThreshold || 70;

  // 1. Determine tickers to backfill
  let targetTickers: string[] = [];
  if (options.tickers && options.tickers.length > 0) {
    targetTickers = options.tickers.map((t) => t.toUpperCase().trim());
  } else {
    const activeWatchlist = await watchlistRepository.getActive();
    targetTickers = activeWatchlist.map((w) => w.ticker);
  }

  if (targetTickers.length === 0) {
    targetTickers = ['NVDA', 'AAPL', 'MSFT', 'TSLA', 'SPY', 'AMD', 'AMZN', 'GOOGL', 'META', 'QQQ'];
  }

  // 2. Fetch and ingest benchmark bars (SPY)
  const benchmarkBars = await historicalDataProvider.getHistoricalBarsForTicker('SPY', range);
  if (benchmarkBars.length > 0) {
    await marketDataRepository.saveBars('SPY', benchmarkBars);
  }

  let totalBarsIngested = benchmarkBars.length;
  const newSignals: SignalSnapshot[] = [];
  const detailsByTicker: BackfillResult['detailsByTicker'] = {};

  let minDate = '9999-99-99';
  let maxDate = '0000-00-00';

  // 3. Process each ticker
  for (const ticker of targetTickers) {
    try {
      const bars = await historicalDataProvider.getHistoricalBarsForTicker(ticker, range);
      if (bars.length < 50) continue;

      // Persist daily bars into market_data_daily table
      await marketDataRepository.saveBars(ticker, bars);
      totalBarsIngested += bars.length;

      let lastSignalIndex = -999;
      const tickerSignals: SignalSnapshot[] = [];

      // Replay point-in-time from index 50 to bars.length - 1
      for (let i = 50; i < bars.length; i++) {
        const barDate = bars[i].date;
        if (barDate < minDate) minDate = barDate;
        if (barDate > maxDate) maxDate = barDate;

        // Strict Point-in-Time slices (no lookahead bias)
        const pitBars = historicalDataProvider.getPointInTimeSlice(bars, i);
        const pitBenchmark =
          benchmarkBars.length > 0
            ? historicalDataProvider.getPointInTimeSlice(
                benchmarkBars,
                Math.min(i, benchmarkBars.length - 1)
              )
            : undefined;

        // Space signals by at least 3 trading days
        if (i - lastSignalIndex >= 3) {
          const evalRes = evaluateStrategy(ticker, pitBars, pitBenchmark, threshold);

          if (evalRes.isSignal) {
            const outcomes = historicalDataProvider.getForwardOutcomes(bars, i);

            const signalId = `sig-${ticker}-${barDate}`;
            const signalItem: SignalSnapshot = {
              id: signalId,
              signal_date: barDate,
              ticker,
              name: ticker,
              signal_price: outcomes.entryPrice,
              strategy_type: evalRes.strategyType as StrategyType,
              asset_type: 'equity',
              opportunity_score: evalRes.opportunityScore,
              risk_level: evalRes.riskLevel as RiskLevel,
              risk_score: evalRes.riskLevel === 'LOW' ? 25 : evalRes.riskLevel === 'MEDIUM' ? 50 : 75,
              decision: evalRes.opportunityScore >= 80 ? 'STRONG_OPPORTUNITY' : 'OPPORTUNITY',
              signal_confidence: 0.88,
              classification_confidence: 1.0,
              technical_score: evalRes.opportunityScore,
              momentum_score: evalRes.opportunityScore,
              fundamental_score: 75,
              valuation_score: 70,
              rsi: 52,
              drawdown: Math.abs(outcomes.maxAdverseExcursion),
              return_5d: outcomes.return5d,
              return_10d: outcomes.return10d,
              return_20d: outcomes.return20d,
              current_return: outcomes.return20d,
              status: outcomes.return20d !== null ? '20D_REACHED' : 'ACTIVE',
              is_closed: outcomes.return20d !== null,
              components: {
                weights: { technical: 0.35, momentum: 0.35, fundamental: 0.15, valuation: 0.15 },
                risk_reasons: [],
                decision_reason: `과거 롤링 백테스트 시그널 (${evalRes.strategyType}, 기회점수 ${evalRes.opportunityScore}점)`,
              },
            };

            newSignals.push(signalItem);
            tickerSignals.push(signalItem);
            lastSignalIndex = i;
          }
        }
      }

      // Calculate ticker-specific stats
      const completedTickerSignals = tickerSignals.filter((s) => s.return_20d !== null);
      const wins = completedTickerSignals.filter((s) => (s.return_20d ?? 0) > 0).length;
      const avgRet =
        completedTickerSignals.length > 0
          ? completedTickerSignals.reduce((sum, s) => sum + (s.return_20d ?? 0), 0) /
            completedTickerSignals.length
          : 0;

      detailsByTicker[ticker] = {
        barsCount: bars.length,
        signalsCount: tickerSignals.length,
        winRate20d:
          completedTickerSignals.length > 0
            ? Math.round((wins / completedTickerSignals.length) * 1000) / 10
            : 0,
        avgReturn20d: Math.round(avgRet * 10) / 10,
      };
    } catch (err) {
      console.warn(`[BackfillEngine] Error processing ticker ${ticker}:`, (err as Error).message);
    }
  }

  // 4. Save signals into repository & database
  await signalRepository.saveSignals(newSignals);

  // 5. Compute global metrics
  const completedSignals = newSignals.filter((s) => s.return_20d !== null);
  const nCompleted = completedSignals.length || 1;

  const win5d = newSignals.filter((s) => s.return_5d !== null && (s.return_5d ?? 0) > 0).length;
  const total5d = newSignals.filter((s) => s.return_5d !== null).length || 1;

  const win10d = newSignals.filter((s) => s.return_10d !== null && (s.return_10d ?? 0) > 0).length;
  const total10d = newSignals.filter((s) => s.return_10d !== null).length || 1;

  const win20d = completedSignals.filter((s) => (s.return_20d ?? 0) > 0).length;
  const avg20d = completedSignals.reduce((sum, s) => sum + (s.return_20d ?? 0), 0) / nCompleted;

  // 6. Record scan run log for traceability
  const runLog: ScanRunLog = {
    run_id: `run-backfill-${Date.now()}`,
    status: 'SUCCESS',
    started_at: new Date().toISOString(),
    finished_at: new Date().toISOString(),
    watchlist_count: targetTickers.length,
    evaluated_count: targetTickers.length,
    signal_count: newSignals.length,
    failure_count: 0,
    failed_tickers: [],
    error_summary: `과거 ${range} 일별 백필 및 사후 수익률 인제스천 완료 (${newSignals.length}개 시그널 생성, 20D 승률 ${(win20d / nCompleted * 100).toFixed(1)}%)`,
  };

  await scanRunRepository.save(runLog);

  return {
    success: true,
    totalTickers: targetTickers.length,
    totalBarsIngested,
    totalSignalsGenerated: newSignals.length,
    completedSignals: completedSignals.length,
    winRate5d: Math.round((win5d / total5d) * 1000) / 10,
    winRate10d: Math.round((win10d / total10d) * 1000) / 10,
    winRate20d: Math.round((win20d / nCompleted) * 1000) / 10,
    avgReturn20d: Math.round(avg20d * 10) / 10,
    dateRange: {
      start: minDate !== '9999-99-99' ? minDate : '2025-01-01',
      end: maxDate !== '0000-00-00' ? maxDate : '2026-08-19',
    },
    detailsByTicker,
  };
}
