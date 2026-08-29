import { describe, it, expect } from 'vitest';
import { evaluateV8, EvaluationInput, MarketSnapshot } from './evaluateV8';
import { RawMarketIndicators } from './opportunityEngine';
import { RawRiskInputs } from './riskEngine';
import { AssetClassification } from '../types/v8';

function classification(strategyType = 'established_growth', confidence = 0.9): AssetClassification {
  return { strategy_type: strategyType, confidence } as unknown as AssetClassification;
}

function strongIndicators(): RawMarketIndicators {
  return {
    price: 110,
    ma20: 105,
    ma50: 100,
    ma200: 95,
    rsi14: 55,
    drawdownFromHigh: -0.06,
    macdHistogramPositive: true,
    return1M: 0.08,
    return3M: 0.15,
    return6M: 0.25,
    relativeStrengthVsSpy: 1.3,
    revenueGrowthYoy: 0.4,
    earningsGrowthYoy: 0.35,
    operatingMargin: 0.32,
    freeCashFlowMargin: 0.25,
    marketCapBillions: 200,
    trailingPe: 20,
    forwardPe: 20,
    psRatio: 5,
    pegRatio: 1.0,
  };
}

function lowRiskInputs(): RawRiskInputs {
  return {
    beta: 1.0,
    volatility20dAnnualized: 0.2,
    maxDrawdown52w: -0.15,
    rsi14: 55,
    priceBelowMa200: false,
  };
}

function highRiskInputs(): RawRiskInputs {
  return {
    beta: 2.5,
    volatility20dAnnualized: 0.7,
    maxDrawdown52w: -0.5,
    rsi14: 80,
    priceBelowMa200: true,
  };
}

function market(overrides: Partial<MarketSnapshot> = {}): MarketSnapshot {
  return {
    price: 110,
    change1d: 1.5,
    indicators: strongIndicators(),
    riskInputs: lowRiskInputs(),
    ...overrides,
  };
}

function baseInput(overrides: Partial<EvaluationInput> = {}): EvaluationInput {
  return {
    ticker: 'TEST',
    evaluationAt: new Date('2024-01-05T10:00:00.000Z'),
    market: market(),
    classification: classification(),
    dataQuality: { data_quality_score: 90 } as never,
    provenance: { source: 'yahoo', isFallback: false },
    ...overrides,
  };
}

describe('evaluateV8', () => {
  it('produces a signal with position sizing for a strong LOW-risk setup', () => {
    const evalResult = evaluateV8(baseInput());
    expect(evalResult.isSignal).toBe(true);
    expect(evalResult.decision.decision).toBe('STRONG_OPPORTUNITY');
    expect(evalResult.decision.actionable).toBe(true);
    // position sizing attached to decision
    expect(evalResult.decision.position_size_pct).toBeGreaterThan(0);
    expect(evalResult.decision.kelly_fraction).toBeGreaterThan(0);
  });

  it('returns isSignal=false and zero position when risk is HIGH', () => {
    const evalResult = evaluateV8(
      baseInput({ market: market({ riskInputs: highRiskInputs() }) })
    );
    expect(evalResult.risk.risk_level).toBe('HIGH');
    expect(evalResult.decision.actionable).toBe(false);
    expect(evalResult.isSignal).toBe(false);
    // HIGH risk cap -> position 0
    expect(evalResult.decision.position_size_pct).toBe(0);
  });

  it('blocks signals on fallback data', () => {
    const evalResult = evaluateV8(
      baseInput({ provenance: { source: 'seed', isFallback: true } })
    );
    expect(evalResult.isSignal).toBe(false);
  });

  it('blocks signals below the quality threshold', () => {
    const evalResult = evaluateV8(
      baseInput({ dataQuality: { data_quality_score: 50 } as never })
    );
    expect(evalResult.isSignal).toBe(false);
  });

  it('respects a custom higher signal threshold', () => {
    const evalResult = evaluateV8(baseInput({ signalThreshold: 99 }));
    // oppScore ~96 < 99
    expect(evalResult.isSignal).toBe(false);
  });

  it('keeps engine version and snapshot fields stable', () => {
    const evalResult = evaluateV8(baseInput());
    expect(evalResult.ticker).toBe('TEST');
    expect(evalResult.engineVersion).toBe('V8.1');
    expect(evalResult.evaluationAt.toISOString()).toBe('2024-01-05T10:00:00.000Z');
  });
});
