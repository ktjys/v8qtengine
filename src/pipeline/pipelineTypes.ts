import { FullTickerEvaluation, ScanRunLog, SignalSnapshot, WatchlistItem } from '../types/v8';

export interface PipelineExecutionOptions {
  providerType?: 'yahoo' | 'seed';
  simulatePartialFailure?: boolean;
  saveToDb?: boolean;
  notifyTelegram?: boolean;
}

export interface PipelineScanResult {
  runLog: ScanRunLog;
  evaluations: FullTickerEvaluation[];
  newSignals: SignalSnapshot[];
  actionableSignals?: FullTickerEvaluation[];
  allSignals: SignalSnapshot[];
  watchlist: WatchlistItem[];
}
