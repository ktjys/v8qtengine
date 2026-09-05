import { AssetClassification, FullTickerEvaluation, ScanRunItem, ScanRunLog, SignalSnapshot } from '../types/v8';
import { evaluationService } from './evaluationService';
import { marketDataService } from '../data/marketDataService';
import { watchlistRepository } from '../db/repositories/watchlistRepository';
import { evaluationRepository } from '../db/repositories/evaluationRepository';
import { signalRepository } from '../db/repositories/signalRepository';
import { scanRunRepository } from '../db/repositories/scanRunRepository';
import { createSignalSnapshot, shouldGenerateSignal } from '../engine/signalEngine';
import { PipelineExecutionOptions, PipelineScanResult } from './pipelineTypes';

export class ScanService {
  async executeScan(
    options: PipelineExecutionOptions = {},
    manualOverrides: Record<string, AssetClassification> = {}
  ): Promise<PipelineScanResult> {
    const startTime = new Date();
    const runId = `run-${Date.now()}`;
    let watchlist: any[] = [];
    try {
      watchlist = await watchlistRepository.getAll();
      // Filter to active items, but if all are marked inactive, fall back to all items
      const activeOnly = watchlist.filter((w) => w.is_active !== false);
      watchlist = activeOnly.length > 0 ? activeOnly : watchlist;
    } catch (wErr) {
      console.warn('[ScanService] Failed to load watchlist from repo:', wErr);
    }

    // If empty, fall back to initial standard watchlist tickers
    let tickers = watchlist.map((w) => w.ticker.toUpperCase().trim());
    if (tickers.length === 0) {
      tickers = [
        'AAPL', 'AMD', 'AMZN', 'GOOGL', 'HOOD', 'JNJ', 'META', 'MSFT',
        'NVDA', 'OKLO', 'ORCL', 'PLTR', 'QQQ', 'SCHD', 'SMH', 'SPCX',
        'SPY', 'TSLA', 'V', 'VOO',
      ];
    }
    // Remove duplicates
    tickers = Array.from(new Set(tickers));

    if (options.providerType) {
      evaluationService.setProvider(options.providerType);
    }

    const items: ScanRunItem[] = [];
    const evaluations: FullTickerEvaluation[] = [];
    const failedList: { ticker: string; error: string }[] = [];

    // Preload assets, fundamentals, and benchmark upfront in parallel to save subrequests
    try {
      await marketDataService.preloadForScan();
    } catch {}

    // Process tickers concurrently in chunks of 10 to balance speed and rate limits
    const BATCH_SIZE = 10;
    for (let i = 0; i < tickers.length; i += BATCH_SIZE) {
      const chunk = tickers.slice(i, i + BATCH_SIZE);
      const promises = chunk.map(async (ticker, chunkIdx) => {
        const globalIndex = i + chunkIdx;
        const itemStart = new Date();

        // Check simulated partial failure on last ticker if requested
        if (options.simulatePartialFailure && globalIndex === tickers.length - 1) {
          const errorMsg = 'Simulated quote API timeout (Gracefully logged and skipped)';
          return {
            failed: { ticker, error: errorMsg },
            item: {
              scan_run_id: runId,
              ticker,
              status: 'FAILED' as const,
              error_code: 'TIMEOUT',
              error_message: errorMsg,
              started_at: itemStart.toISOString(),
              finished_at: new Date().toISOString(),
            },
          };
        }

        try {
          const evalResult = await evaluationService.evaluateTicker(ticker, manualOverrides[ticker]);
          return {
            evaluation: evalResult,
            item: {
              scan_run_id: runId,
              ticker,
              status: 'SUCCESS' as const,
              started_at: itemStart.toISOString(),
              finished_at: new Date().toISOString(),
              opportunity_score: evalResult.opportunity.opportunity_score,
              decision: evalResult.decision.decision,
            },
          };
        } catch (err) {
          const errorMsg = (err as Error).message || 'Evaluation failed';
          return {
            failed: { ticker, error: errorMsg },
            item: {
              scan_run_id: runId,
              ticker,
              status: 'FAILED' as const,
              error_code: 'EVAL_ERROR',
              error_message: errorMsg,
              started_at: itemStart.toISOString(),
              finished_at: new Date().toISOString(),
            },
          };
        }
      });

      const results = await Promise.all(promises);
      for (const res of results) {
        if (res.evaluation) {
          evaluations.push(res.evaluation);
        }
        if (res.failed) {
          failedList.push(res.failed);
        }
        if (res.item) {
          items.push(res.item);
        }
      }
    }

    // Save evaluations to DB
    if (options.saveToDb !== false) {
      try {
        await evaluationRepository.saveAll(evaluations);
      } catch (err) {
        console.warn('[ScanService] evaluationRepository.saveAll warning:', err);
      }
    }

    // Check newly generated signals (strictly signal_generated == evaluateV8().isSignal)
    const actionableList = evaluations.filter((ev) => ev.signal_generated);
    let existingSignals: SignalSnapshot[] = [];
    try {
      existingSignals = await signalRepository.getAll();
    } catch {}

    const newSignals: SignalSnapshot[] = [];

    for (const ev of evaluations) {
      if (!ev.signal_generated) {
        continue;
      }
      if (shouldGenerateSignal(ev, existingSignals)) {
        const snap = createSignalSnapshot(ev);
        newSignals.push(snap);
      }
    }

    // Save newly generated signals in 1 single batch call
    if (options.saveToDb !== false && newSignals.length > 0) {
      try {
        await signalRepository.saveSignals(newSignals);
      } catch (err) {
        console.warn('[ScanService] signalRepository.saveSignals warning:', err);
      }
    }

    const finishTime = new Date();
    const scanLog: ScanRunLog = {
      run_id: runId,
      started_at: startTime.toISOString(),
      finished_at: finishTime.toISOString(),
      watchlist_count: watchlist.length || tickers.length,
      evaluated_count: evaluations.length,
      signal_count: actionableList.length, // 현재 유효 기회 총 건수
      failure_count: failedList.length,
      failed_tickers: failedList,
      items,
      status: failedList.length > 0 ? 'PARTIAL_SUCCESS' : 'SUCCESS',
      error_summary:
        failedList.length > 0
          ? `${failedList.length}건 API 실패 발생했으나 전체 스캔 지속 완료`
          : undefined,
    };

    if (options.saveToDb !== false) {
      try {
        await scanRunRepository.save(scanLog);
      } catch {}
    }

    let allSignals: SignalSnapshot[] = [];
    try {
      allSignals = await signalRepository.getAll();
    } catch {
      allSignals = newSignals;
    }

    let currentWatchlist: any[] = [];
    try {
      currentWatchlist = await watchlistRepository.getAll();
    } catch {
      currentWatchlist = watchlist;
    }

    return {
      runLog: scanLog,
      evaluations,
      newSignals,
      actionableSignals: actionableList,
      allSignals,
      watchlist: currentWatchlist,
    };
  }
}

export const scanService = new ScanService();
