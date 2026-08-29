import { describe, it, expect } from 'vitest';
import { calculateOpportunity, getStrategyWeights, RawMarketIndicators } from './opportunityEngine';
import { AssetClassification } from '../types/v8';

function classify(strategyType: string, assetType = 'equity'): AssetClassification {
  return { strategy_type: strategyType, asset_type: assetType } as unknown as AssetClassification;
}

function strongIndicators(overrides: Partial<RawMarketIndicators> = {}): RawMarketIndicators {
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
    ...overrides,
  };
}

describe('getStrategyWeights', () => {
  it('sums to 1.0 for each strategy', () => {
    const strategies = [
      'broad_market_etf',
      'growth_etf',
      'dividend_etf',
      'sector_etf',
      'quality',
      'established_growth',
      'speculative',
      'general_equity',
    ];
    for (const s of strategies) {
      const w = getStrategyWeights(s as never);
      const sum = w.technical + w.momentum + w.fundamental + w.valuation;
      expect(sum).toBeCloseTo(1.0, 5);
    }
  });

  it('gives established_growth meaningful fundamental weight', () => {
    const w = getStrategyWeights('established_growth');
    expect(w.fundamental).toBe(0.3);
    expect(w.technical).toBe(0.25);
  });
});

describe('calculateOpportunity', () => {
  it('scores a strong uptrend equity near the top', () => {
    const result = calculateOpportunity(
      classify('established_growth'),
      strongIndicators()
    );
    // tech=98, mom=98, fund=98, val=84 -> 0.25*98+0.30*98+0.30*98+0.15*84=95.9 -> 96
    expect(result.opportunity_score).toBe(96);
    expect(result.sub_scores.technical_score).toBe(98);
    expect(result.sub_scores.momentum_score).toBe(98);
    expect(result.sub_scores.fundamental_score).toBe(98);
  });

  it('produces null fundamental score for ETFs', () => {
    const result = calculateOpportunity(classify('broad_market_etf', 'etf'), strongIndicators());
    expect(result.sub_scores.fundamental_score).toBeNull();
  });

  it('re-normalizes weights to drop fundamental for ETFs', () => {
    const result = calculateOpportunity(classify('broad_market_etf', 'etf'), strongIndicators());
    // broad_market_etf weights: tech 0.45, mom 0.45, val 0.10, fund 0.0
    // normalized to 0.45/0.45/0.10 -> same but no fundamental used
    const w = result.weights_used;
    expect(w.technical + w.momentum + w.valuation).toBeCloseTo(1.0, 5);
  });

  it('scores a weak bearish signal low', () => {
    const result = calculateOpportunity(
      classify('general_equity'),
      strongIndicators({
        price: 80,
        ma20: 95,
        ma50: 100,
        ma200: 105,
        rsi14: 30,
        drawdownFromHigh: -0.25,
        macdHistogramPositive: false,
        return1M: -0.08,
        return3M: -0.15,
        return6M: -0.2,
        relativeStrengthVsSpy: 0.8,
        revenueGrowthYoy: -0.1,
        earningsGrowthYoy: -0.1,
        operatingMargin: 0.02,
        forwardPe: 60,
        pegRatio: 4.0,
      })
    );
    expect(result.opportunity_score).toBeLessThan(40);
  });

  it('clamps scores to the valid range', () => {
    const result = calculateOpportunity(classify('established_growth'), strongIndicators());
    expect(result.opportunity_score).toBeGreaterThanOrEqual(10);
    expect(result.opportunity_score).toBeLessThanOrEqual(98);
    expect(result.sub_scores.technical_score).toBeLessThanOrEqual(98);
    expect(result.sub_scores.momentum_score).toBeLessThanOrEqual(98);
  });
});
