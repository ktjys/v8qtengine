import { describe, it, expect } from 'vitest';
import { calculateReplayPerformance, computeBreakdowns, BreakdownSignal } from './performanceCalculator';
import { SimulatedTradeSignal } from './backtestTypes';

function signal(overrides: Partial<SimulatedTradeSignal>): SimulatedTradeSignal {
  return {
    id: 'sig-test',
    ticker: 'TEST',
    entryDate: '2024-01-01',
    entryPrice: 100,
    strategyType: 'general_equity',
    riskLevel: 'LOW',
    opportunityScore: 80,
    return20d: 0.1,
    isWin20d: true,
    ...overrides,
  };
}

describe('calculateReplayPerformance weighted metrics', () => {
  it('computes weighted and equal-weight 20d returns from positionSizePct', () => {
    const result = calculateReplayPerformance([
      signal({ id: 'a', positionSizePct: 4, return20d: 0.1 }),
      signal({ id: 'b', positionSizePct: 2, return20d: -0.05 }),
      signal({ id: 'c', positionSizePct: 1, return20d: 0.2 }),
    ]);

    // weighted = (4*0.1 + 2*(-0.05) + 1*0.2) / (4+2+1) = 0.5 / 7 = 0.07143 -> rounds to 0.07
    expect(result.weighted_avg_return_20d).toBe(0.07);
    // equal-weight = (0.1 - 0.05 + 0.2) / 3 = 0.08333 -> rounds to 0.08
    expect(result.equal_weight_avg_return_20d).toBe(0.08);
    expect(result.weighted_monitor_count).toBe(3);
  });

  it('excludes signals without positionSizePct from weighted metrics', () => {
    const result = calculateReplayPerformance([
      signal({ id: 'a', positionSizePct: 4, return20d: 0.1 }),
      signal({ id: 'b', return20d: 0.5 }), // no positionSizePct -> excluded
    ]);

    // only 'a' sized: weighted = 0.1, equal-weight = 0.1, count = 1
    expect(result.weighted_avg_return_20d).toBe(0.1);
    expect(result.equal_weight_avg_return_20d).toBe(0.1);
    expect(result.weighted_monitor_count).toBe(1);
  });

  it('leaves weighted metrics undefined when no signal has positionSizePct', () => {
    const result = calculateReplayPerformance([
      signal({ id: 'a', return20d: 0.1 }),
      signal({ id: 'b', return20d: 0.2 }),
    ]);
    expect(result.weighted_avg_return_20d).toBeUndefined();
    expect(result.equal_weight_avg_return_20d).toBeUndefined();
    expect(result.weighted_monitor_count).toBeUndefined();
  });

  it('handles empty signal set gracefully', () => {
    const result = calculateReplayPerformance([]);
    expect(result.weighted_avg_return_20d).toBeUndefined();
    expect(result.equal_weight_avg_return_20d).toBeUndefined();
    expect(result.weighted_monitor_count).toBeUndefined();
  });
});

describe('computeBreakdowns', () => {
  const signals: BreakdownSignal[] = [
    { return20d: 0.1, strategy: 'large_cap_growth', riskLevel: 'LOW', opportunityScore: 80 },
    { return20d: 0.05, strategy: 'large_cap_growth', riskLevel: 'LOW', opportunityScore: 78 },
    { return20d: -0.04, strategy: 'large_cap_growth', riskLevel: 'LOW', opportunityScore: 70 },
    { return20d: 0.2, strategy: 'dividend_defensive', riskLevel: 'MEDIUM', opportunityScore: 90 },
  ];

  it('breaks down by strategy with win rate and avg return', () => {
    const { by_strategy } = computeBreakdowns(signals);
    expect(by_strategy['large_cap_growth']).toEqual({
      count: 3,
      win_rate_20d: 66.7,
      avg_return_20d: 0,
    });
    expect(by_strategy['dividend_defensive']).toEqual({
      count: 1,
      win_rate_20d: 100,
      avg_return_20d: 0.2,
    });
  });

  it('breaks down by risk level filling all three buckets', () => {
    const { by_risk } = computeBreakdowns(signals);
    expect(by_risk.LOW.count).toBe(3);
    expect(by_risk.LOW.win_rate_20d).toBe(66.7);
    expect(by_risk.MEDIUM.count).toBe(1);
    expect(by_risk.HIGH.count).toBe(0);
  });

  it('breaks down by opportunity bucket', () => {
    const { by_opportunity_bucket } = computeBreakdowns(signals);
    expect(by_opportunity_bucket['75 - 84 (High)'].count).toBe(2);
    expect(by_opportunity_bucket['85+ (Exceptional)'].count).toBe(1);
  });

  it('defaults strategy to general_equity when empty', () => {
    const { by_strategy } = computeBreakdowns([
      { return20d: 0.1, strategy: '', riskLevel: 'LOW', opportunityScore: 80 },
    ]);
    expect(by_strategy['general_equity'].count).toBe(1);
  });
});
