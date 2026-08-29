import { BacktestSummary, RiskLevel, StrategyType } from '../types/v8';

export interface BacktestRequestConfig {
  startDate?: string; // e.g. '2024-01-01'
  endDate?: string; // e.g. '2026-08-19'
  tickers?: string[]; // specific universe or all watchlist
  opportunityThreshold?: number; // e.g. 70
}

export interface SimulatedTradeSignal {
  id: string;
  ticker: string;
  entryDate: string;
  entryPrice: number;
  strategyType: StrategyType;
  riskLevel: RiskLevel;
  opportunityScore: number;
  /** 리스크 기반 동적 제안 포지션 비중 (포트폴리오 대비 %) */
  positionSizePct?: number;
  exitPrice5d?: number;
  return5d?: number;
  exitPrice10d?: number;
  return10d?: number;
  exitPrice20d?: number;
  return20d?: number;
  /** 최대 불리한 일탈(Max Adverse Excursion): 진입 후 최저가 기준 낙폭 (Portfolio MDD 아님) */
  maxAdverseExcursionTrade?: number;
  isWin20d?: boolean;
}

export interface EquityCurvePoint {
  date: string;
  cumulativeReturn: number;
  benchmarkReturn: number;
  drawdown: number;
}

export interface StandaloneBacktestResult {
  summary: BacktestSummary;
  signals: SimulatedTradeSignal[];
  equityCurve: EquityCurvePoint[];
  startDate: string;
  endDate: string;
  testedUniverseCount: number;
}
