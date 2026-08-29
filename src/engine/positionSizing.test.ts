import { describe, it, expect } from 'vitest';
import { calculatePositionSizing } from './positionSizing';
import { V8Evaluation } from './evaluateV8';

interface SizingOverrides {
  confidence?: number;
  opportunityScore?: number;
  return3M?: number;
  return6M?: number;
  maxDrawdown52w?: number;
  volatility20dAnnualized?: number;
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
}

function baseEvaluation(overrides: SizingOverrides = {}): V8Evaluation {
  const {
    confidence = 0.9,
    opportunityScore = 85,
    return3M = 0.15,
    return6M = 0.2,
    maxDrawdown52w = -0.2,
    volatility20dAnnualized = 30,
    riskLevel = 'LOW',
  } = overrides;

  return {
    ticker: 'TEST',
    evaluationAt: new Date('2024-01-01'),
    engineVersion: 'V8.1',
    classification: {} as never,
    opportunity: {
      opportunity_score: opportunityScore,
      sub_scores: {} as never,
      weights_used: {} as never,
      technical_details: {} as never,
      momentum_details: {
        return3M,
        return6M,
      } as never,
      fundamental_details: {} as never,
      valuation_details: {} as never,
    },
    risk: {
      risk_score: 0,
      risk_level: riskLevel,
      components: {
        beta: 1,
        volatility20dAnnualized,
        maxDrawdown52w,
        isSpeculative: false,
        technicalInstabilityScore: 0,
        dataUncertaintyScore: 0,
      },
      risk_reasons: [],
    },
    decision: {
      decision: 'STRONG_OPPORTUNITY',
      opportunity_score: opportunityScore,
      confidence,
      reason: '',
      actionable: true,
      threshold_met: true,
    },
    isSignal: true,
  };
}

describe('calculatePositionSizing', () => {
  it('returns zero position for HIGH risk level (risk-cap blocking)', () => {
    const result = calculatePositionSizing(baseEvaluation({ riskLevel: 'HIGH' }));
    expect(result.risk_cap).toBe(0);
    expect(result.position_size_pct).toBe(0);
  });

  it('scales MEDIUM risk to half of LOW (risk cap 0.5)', () => {
    const low = calculatePositionSizing(baseEvaluation({ riskLevel: 'LOW' }));
    const medium = calculatePositionSizing(baseEvaluation({ riskLevel: 'MEDIUM' }));
    expect(medium.risk_cap).toBe(0.5);
    expect(medium.position_size_pct).toBeLessThan(low.position_size_pct);
  });

  it('computes correct position size for a strong LOW-risk signal', () => {
    const result = calculatePositionSizing(
      baseEvaluation({ riskLevel: 'LOW', confidence: 0.9, opportunityScore: 85 })
    );
    // winProb = 0.9*0.7 + 0.85*0.3 = 0.885
    expect(result.win_probability).toBe(0.885);
    // payoffRatio = 1 + (0.20/0.20)*0.5 = 1.5 (drawdown > 0.02)
    expect(result.payoff_ratio).toBe(1.5);
    // kelly = 0.885 - 0.115/1.5 = 0.8083
    expect(result.kelly_fraction).toBe(0.808);
    // vol 30% <= baseline 30% -> dampener = 1.0
    expect(result.volatility_dampener).toBe(1);
    // position = 10 * 0.8083 * 0.5 * 1.0 * 1.0 * 0.9 = 3.64
    expect(result.position_size_pct).toBe(3.64);
  });

  it('returns zero position when Kelly fraction is not positive (low win probability)', () => {
    const result = calculatePositionSizing(
      baseEvaluation({
        riskLevel: 'LOW',
        confidence: 0.3,
        opportunityScore: 10,
        maxDrawdown52w: -0.02,
      })
    );
    // payoffRatio = 2.0 (drawdown <= 0.02 -> default)
    // winProb = 0.3*0.7 + 0.1*0.3 = 0.24
    // kelly = 0.24 - 0.76/2.0 = 0.24 - 0.38 = -0.14
    expect(result.kelly_fraction).toBe(-0.14);
    expect(result.position_size_pct).toBe(0);
  });

  it('dampens position size with high volatility', () => {
    const lowVol = calculatePositionSizing(
      baseEvaluation({ volatility20dAnnualized: 20 })
    );
    const highVol = calculatePositionSizing(
      baseEvaluation({ volatility20dAnnualized: 60 })
    );
    // vol 60% -> dampener = 1 - (0.6-0.3)/(0.8-0.3) = 1 - 0.6 = 0.4
    expect(highVol.volatility_dampener).toBe(0.4);
    expect(highVol.position_size_pct).toBeLessThan(lowVol.position_size_pct);
  });

  it('caps position size at MAX_POSITION_PCT', () => {
    const result = calculatePositionSizing(
      baseEvaluation({ riskLevel: 'LOW', confidence: 0.95, opportunityScore: 100 })
    );
    expect(result.position_size_pct).toBeLessThanOrEqual(10);
  });
});
