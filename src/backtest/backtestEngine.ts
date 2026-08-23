import { runHistoricalReplay } from './strategyReplay';
import { calculateReplayPerformance } from './performanceCalculator';
import { BacktestRequestConfig, StandaloneBacktestResult } from './backtestTypes';
import { SignalSnapshot, BacktestSummary } from '../types/v8';
import { calculateBacktestMetrics as calculateLegacyMetrics } from '../engine/backtestEngine';

export class BacktestEngine {
  async runReplay(config: BacktestRequestConfig): Promise<StandaloneBacktestResult> {
    return runHistoricalReplay(config);
  }

  calculateMetricsFromSnapshots(signals: SignalSnapshot[]): BacktestSummary {
    return calculateLegacyMetrics(signals);
  }
}

export const backtestEngine = new BacktestEngine();
export { runHistoricalReplay, calculateReplayPerformance };
