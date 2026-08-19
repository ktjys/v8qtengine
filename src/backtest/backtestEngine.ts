import { runHistoricalReplay } from './strategyReplay';
import { calculateReplayPerformance } from './performanceCalculator';
import { BacktestRequestConfig, ReplayComparisonResult } from './backtestTypes';
import { SignalSnapshot, BacktestSummary } from '../types/v8';
import { calculateBacktestMetrics as calculateLegacyMetrics } from '../engine/backtestEngine';

export class BacktestEngine {
  async runReplay(config: BacktestRequestConfig): Promise<ReplayComparisonResult> {
    return runHistoricalReplay(config);
  }

  calculateMetricsFromSnapshots(signals: SignalSnapshot[], version: 'V8.0' | 'V7.0'): BacktestSummary {
    return calculateLegacyMetrics(signals, version);
  }
}

export const backtestEngine = new BacktestEngine();
export { runHistoricalReplay, calculateReplayPerformance };
