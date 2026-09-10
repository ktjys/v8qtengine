import { describe, it, expect } from 'vitest';
import { calculateDipTiming, calculateBlueChipSuitability, evaluateDipBuyStrategy, ensureDipEvaluation } from './dipBuyEngine';
import { RawMarketIndicators } from './opportunityEngine';
import { RawRiskInputs } from './riskEngine';

describe('dipBuyEngine — Drawdown Normalization & Dip Timing', () => {
  it('correctly handles drawdown passed as ratio (-0.054 -> -5.4%)', () => {
    const indicators: Partial<RawMarketIndicators> = {
      price: 217.55,
      ma20: 220,
      ma50: 210,
      ma200: 190,
      rsi14: 42.0,
      drawdownFromHigh: -0.054, // -5.4% in ratio form
    };

    const timing = calculateDipTiming(indicators);
    expect(timing.drawdownFromHigh).toBeCloseTo(-5.4, 1);
    expect(timing.drawdownLabel).toContain('-5.4%');
    expect(timing.drawdownLabel).not.toContain('-540');
    expect(timing.drawdownLabel).toContain('얕은 눌림목');
  });

  it('correctly handles drawdown passed as percentage (-5.4 -> -5.4%) without 100x multiplication', () => {
    const indicators: Partial<RawMarketIndicators> = {
      price: 217.55,
      ma20: 220,
      ma50: 210,
      ma200: 190,
      rsi14: 42.0,
      drawdownFromHigh: -5.4, // -5.4% already in percentage form
    };

    const timing = calculateDipTiming(indicators);
    expect(timing.drawdownFromHigh).toBeCloseTo(-5.4, 1);
    expect(timing.drawdownLabel).toContain('-5.4%');
    expect(timing.drawdownLabel).not.toContain('-540');
    expect(timing.drawdownLabel).toContain('얕은 눌림목');
  });

  it('correctly handles positive percentage drawdown input (e.g. 8.2% -> -8.2%)', () => {
    const indicators: Partial<RawMarketIndicators> = {
      price: 217.55,
      ma20: 220,
      ma50: 210,
      ma200: 190,
      rsi14: 40.0,
      drawdownFromHigh: 8.2,
    };

    const timing = calculateDipTiming(indicators);
    expect(timing.drawdownFromHigh).toBeCloseTo(-8.2, 1);
    expect(timing.drawdownLabel).toContain('-8.2%');
    expect(timing.drawdownLabel).toContain('황금 눌림목');
  });

  it('ensures NVDA gets high suitability and correct timing in ensureDipEvaluation', () => {
    const mockEvaluation = {
      ticker: 'NVDA',
      name: 'NVIDIA Corporation',
      price: 217.55,
      change1d: 1.32,
      classification: {
        ticker: 'NVDA',
        asset_type: 'equity',
        strategy_type: 'established_growth',
        confidence: 0.95,
        classification_source: 'auto',
        reason: '테스트',
        classified_at: '2026-09-09',
        updated_at: '2026-09-09',
      },
      opportunity: {
        opportunity_score: 82,
        technical_details: {
          rsi14: 44.5,
          drawdownFromHigh: -5.4, // percentage from opportunityEngine
          priceAboveMa20: true,
          ma50Above200: true,
          macdHistogramPositive: true,
        },
        fundamental_details: {
          marketCapBillions: 4400,
          operatingMargin: 62,
          freeCashFlowMargin: 48,
        },
        momentum_details: {
          return1M: 0.05,
          return3M: 0.12,
          return6M: 0.25,
          relativeStrengthVsSpy: 1.1,
        },
      },
      risk: {
        risk_level: 'LOW',
        risk_score: 30,
        components: {
          beta: 1.15,
          volatility20dAnnualized: 0.28,
          maxDrawdown52w: -0.054,
        },
      },
    };

    const dip = ensureDipEvaluation(mockEvaluation);
    expect(dip.suitability.tier).toBe('S');
    expect(dip.suitability.score).toBeGreaterThanOrEqual(85);
    expect(dip.timing.drawdownFromHigh).toBeCloseTo(-5.4, 1);
    expect(dip.timing.drawdownLabel).not.toContain('-540');
    expect(dip.timing.drawdownLabel).toContain('-5.4%');
  });
});
