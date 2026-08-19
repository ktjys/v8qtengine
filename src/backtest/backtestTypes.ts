import { BacktestSummary, RiskLevel, StrategyType } from '../types/v8';

export interface BacktestRequestConfig {
  startDate: string; // e.g. '2024-01-01'
  endDate: string; // e.g. '2026-08-19'
  tickers?: string[]; // specific universe or all watchlist
  opportunityThresholdV8?: number; // e.g. 70
  opportunityThresholdV7?: number; // e.g. 65
}

export interface SimulatedTradeSignal {
  id: string;
  ticker: string;
  entryDate: string;
  entryPrice: number;
  strategyVersion: 'V8.0' | 'V7.0';
  strategyType: StrategyType;
  riskLevel: RiskLevel;
  opportunityScore: number;
  exitPrice5d?: number;
  return5d?: number;
  exitPrice10d?: number;
  return10d?: number;
  exitPrice20d?: number;
  return20d?: number;
  maxDrawdownTrade?: number;
  isWin20d?: boolean;
}

export interface ReplayComparisonResult {
  v8: BacktestSummary;
  v7: BacktestSummary;
  signalsV8: SimulatedTradeSignal[];
  signalsV7: SimulatedTradeSignal[];
  improvement: {
    winRateDiff20d: number;
    avgReturnDiff20d: number;
    maxDrawdownReduction: number;
    profitFactorDiff: number;
  };
  startDate: string;
  endDate: string;
  testedUniverseCount: number;
}
