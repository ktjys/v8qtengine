import { AssetClassification, FullTickerEvaluation, ScanRunItem, ScanRunLog, SignalSnapshot } from '../types/v8';
import { evaluationService } from './evaluationService';
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
    const watchlist = await watchlistRepository.getActive();
    const tickers = watchlist.map((w) => w.ticker);

    if (options.providerType) {
      evaluationService.setProvider(options.providerType);
    }

    const items: ScanRunItem[] = [];
    const evaluations: FullTickerEvaluation[] = [];
    const failedList: { ticker: string; error: string }[] = [];

    for (let i = 0; i < tickers.length; i++) {
      const ticker = tickers[i];
      const itemStart = new Date();

      // Check simulated partial failure on last ticker if requested
      if (options.simulatePartialFailure && i === tickers.length - 1) {
        const errorMsg = 'Simulated quote API timeout (Gracefully logged and skipped)';
        failedList.push({ ticker, error: errorMsg });
        items.push({
          scan_run_id: runId,
          ticker,
          status: 'FAILED',
          error_code: 'TIMEOUT',
          error_message: errorMsg,
          started_at: itemStart.toISOString(),
          finished_at: new Date().toISOString(),
        });
        continue;
      }

      try {
        const evalResult = await evaluationService.evaluateTicker(ticker, manualOverrides[ticker]);
        evaluations.push(evalResult);

        items.push({
          scan_run_id: runId,
          ticker,
          status: 'SUCCESS',
          started_at: itemStart.toISOString(),
          finished_at: new Date().toISOString(),
          opportunity_score: evalResult.opportunity.opportunity_score,
          decision: evalResult.decision.decision,
        });
      } catch (err) {
        const errorMsg = (err as Error).message || 'Evaluation failed';
        failedList.push({ ticker, error: errorMsg });
        items.push({
          scan_run_id: runId,
          ticker,
          status: 'FAILED',
          error_code: 'EVAL_ERROR',
          error_message: errorMsg,
          started_at: itemStart.toISOString(),
          finished_at: new Date().toISOString(),
        });
      }
    }

    // Save evaluations to DB
    if (options.saveToDb !== false) {
      await evaluationRepository.saveAll(evaluations);
    }

    // Check newly actionable signals
    const existingSignals = await signalRepository.getAll();
    const newSignals: SignalSnapshot[] = [];

    for (const ev of evaluations) {
      if (shouldGenerateSignal(ev, existingSignals)) {
        const snap = createSignalSnapshot(ev);
        newSignals.push(snap);
        if (options.saveToDb !== false) {
          await signalRepository.save(snap);
        }
      }
    }

    const finishTime = new Date();
    const scanLog: ScanRunLog = {
      run_id: runId,
      started_at: startTime.toISOString(),
      finished_at: finishTime.toISOString(),
      watchlist_count: watchlist.length,
      evaluated_count: evaluations.length,
      signal_count: newSignals.length,
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
      await scanRunRepository.save(scanLog);
    }

    const allSignals = await signalRepository.getAll();
    const currentWatchlist = await watchlistRepository.getAll();

    return {
      runLog: scanLog,
      evaluations,
      newSignals,
      allSignals,
      watchlist: currentWatchlist,
    };
  }
}

export const scanService = new ScanService();
