import { describe, it, expect } from 'vitest';
import { calculateRisk, RawRiskInputs } from './riskEngine';
import { AssetClassification } from '../types/v8';

function classify(strategyType: string): AssetClassification {
  return { strategy_type: strategyType } as unknown as AssetClassification;
}

function lowRiskInputs(overrides: Partial<RawRiskInputs> = {}): RawRiskInputs {
  return {
    beta: 1.0,
    volatility20dAnnualized: 0.2,
    maxDrawdown52w: -0.15,
    rsi14: 55,
    priceBelowMa200: false,
    ...overrides,
  };
}

describe('calculateRisk', () => {
  it('rates a stable equity as LOW risk', () => {
    const r = calculateRisk(classify('general_equity'), lowRiskInputs());
    // beta neutral, vol 0.2 in [0.18,0.4], mdd -0.15 above -0.25 -> baseline 30
    expect(r.risk_score).toBe(30);
    expect(r.risk_level).toBe('LOW');
  });

  it('rates an extreme speculative stock as HIGH and clamps score to 99', () => {
    const r = calculateRisk(
      classify('speculative'),
      lowRiskInputs({
        beta: 2.5,
        volatility20dAnnualized: 0.7,
        maxDrawdown52w: -0.5,
        rsi14: 80,
        priceBelowMa200: true,
      })
    );
    // 30 + 24(beta) + 26(vol) + 18(mdd) + 20(spec) + 12(ma) + 8(rsi) = 138 -> clamp 99
    expect(r.risk_score).toBe(99);
    expect(r.risk_level).toBe('HIGH');
  });

  it('rates a moderately volatile equity as MEDIUM', () => {
    const r = calculateRisk(
      classify('general_equity'),
      lowRiskInputs({ beta: 1.5, volatility20dAnnualized: 0.3, maxDrawdown52w: -0.26, rsi14: 70 })
    );
    // 30 + 12(beta>1.4) + 10(mdd<-0.25) = 52 -> MEDIUM
    expect(r.risk_score).toBe(52);
    expect(r.risk_level).toBe('MEDIUM');
  });

  it('subtracts risk for very low volatility', () => {
    const r = calculateRisk(classify('general_equity'), lowRiskInputs({ volatility20dAnnualized: 0.1 }));
    // vol < 0.18 -> -6, baseline 30 -> 24
    expect(r.risk_score).toBe(24);
  });

  it('adds risk when price is below 200MA', () => {
    const r = calculateRisk(classify('general_equity'), lowRiskInputs({ priceBelowMa200: true }));
    // baseline 30 + 12(ma) = 42 -> MEDIUM boundary
    expect(r.risk_score).toBe(42);
  });

  it('adds data uncertainty penalty for missing data points', () => {
    const r = calculateRisk(classify('general_equity'), lowRiskInputs({ missingDataPoints: 2 }));
    // 30 + 2*5 = 40
    expect(r.risk_score).toBe(40);
    expect(r.risk_reasons.some((x) => x.includes('누락'))).toBe(true);
  });
});
