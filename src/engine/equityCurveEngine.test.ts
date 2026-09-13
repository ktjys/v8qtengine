import { describe, it, expect } from 'vitest';
import { EquityCurveEngine } from './equityCurveEngine';
import { RegimeAnalysisEngine } from './regimeAnalysisEngine';
import { SignalSnapshot } from '../types/v8';

describe('EquityCurveEngine & RegimeAnalysisEngine', () => {
  const sampleSignals: SignalSnapshot[] = [
    {
      id: 'sig-1',
      signal_date: '2026-03-01',
      ticker: 'SCHD',
      name: 'Schwab Dividend ETF',
      signal_price: 80.0,
      strategy_type: 'dividend_etf',
      asset_type: 'etf',
      opportunity_score: 75,
      risk_level: 'LOW',
      risk_score: 25,
      decision: 'OPPORTUNITY',
      signal_confidence: 0.85,
      classification_confidence: 0.95,
      technical_score: 75,
      momentum_score: 70,
      fundamental_score: null,
      valuation_score: 80,
      rsi: 48,
      drawdown: -2,
      return_20d: 4.5,
      return_10d: 2.5,
      return_5d: 1.2,
      current_return: 4.5,
      status: '20D_REACHED',
      is_closed: true,
      components: { weights: { technical: 0.3, momentum: 0.3, fundamental: 0.2, valuation: 0.2 }, risk_reasons: [], decision_reason: '' },
    },
    {
      id: 'sig-2',
      signal_date: '2026-05-10',
      ticker: 'AAPL',
      name: 'Apple Inc.',
      signal_price: 210.0,
      strategy_type: 'established_growth',
      asset_type: 'equity',
      opportunity_score: 82,
      risk_level: 'LOW',
      risk_score: 30,
      decision: 'STRONG_OPPORTUNITY',
      signal_confidence: 0.9,
      classification_confidence: 0.95,
      technical_score: 85,
      momentum_score: 82,
      fundamental_score: 88,
      valuation_score: 70,
      rsi: 54,
      drawdown: -3,
      return_20d: 8.2,
      return_10d: 4.2,
      return_5d: 2.1,
      current_return: 8.2,
      status: '20D_REACHED',
      is_closed: true,
      components: { weights: { technical: 0.3, momentum: 0.3, fundamental: 0.2, valuation: 0.2 }, risk_reasons: [], decision_reason: '' },
    },
    {
      id: 'sig-3',
      signal_date: '2026-07-15',
      ticker: 'NVDA',
      name: 'NVIDIA Corporation',
      signal_price: 120.0,
      strategy_type: 'established_growth',
      asset_type: 'equity',
      opportunity_score: 88,
      risk_level: 'MEDIUM',
      risk_score: 52,
      decision: 'STRONG_OPPORTUNITY',
      signal_confidence: 0.92,
      classification_confidence: 0.96,
      technical_score: 90,
      momentum_score: 94,
      fundamental_score: 91,
      valuation_score: 60,
      rsi: 62,
      drawdown: -5,
      return_20d: 16.4,
      return_10d: 8.5,
      return_5d: 5.2,
      current_return: 16.4,
      status: '20D_REACHED',
      is_closed: true,
      components: { weights: { technical: 0.3, momentum: 0.3, fundamental: 0.2, valuation: 0.2 }, risk_reasons: [], decision_reason: '' },
    },
  ];

  it('calculates equity curve and benchmarks accurately', () => {
    const res = EquityCurveEngine.calculateEquityCurve(sampleSignals, {
      initialCapital: 100000,
      startDate: '2026-03-01',
      endDate: '2026-08-01',
    });

    expect(res.dataPoints.length).toBeGreaterThan(50);
    expect(res.metrics.totalStrategyReturn).toBeGreaterThan(0);
    expect(res.metrics.cumulativeAlpha).toBeDefined();
    expect(res.metrics.sharpeRatio).toBeGreaterThan(0);
    expect(res.metrics.finalPortfolioValue).toBeGreaterThan(100000);
  });

  it('analyzes market regimes with bull, neutral, and bear metrics', () => {
    const res = RegimeAnalysisEngine.analyzeRegimes(sampleSignals);
    expect(res.regimes.length).toBe(5);
    const bull = res.regimes.find((r) => r.regime === 'BULL');
    expect(bull).toBeDefined();
    expect(bull?.winRate).toBeGreaterThan(60);
    expect(res.overallAlpha).toBeGreaterThan(0);
  });
});
