import { describe, it, expect } from 'vitest';
import { calculateBacktestMetrics } from './backtestEngine';
import { SignalSnapshot } from '../types/v8';

function signal(signal_date: string, ticker = 'TEST', return20d: number | null = 0.1): SignalSnapshot {
  return {
    ticker,
    signal_date,
    return_20d: return20d,
    strategy_type: 'established_growth',
    risk_level: 'LOW',
    opportunity_score: 80,
  } as unknown as SignalSnapshot;
}

describe('calculateBacktestMetrics', () => {
  it('deduplicates signals on identical ticker + signal_date', () => {
    const result = calculateBacktestMetrics([
      signal('2024-01-05', 'TEST', 0.1),
      signal('2024-01-05', 'TEST', 0.1),
    ]);
    expect(result.total_signals).toBe(1);
    expect(result.completed_signals).toBe(1);
  });

  it('counts the same ticker on different dates separately', () => {
    const result = calculateBacktestMetrics([
      signal('2024-01-05', 'TEST', 0.1),
      signal('2024-01-06', 'TEST', 0.2),
    ]);
    expect(result.total_signals).toBe(2);
    expect(result.completed_signals).toBe(2);
  });

  it('counts different tickers on the same date separately', () => {
    const result = calculateBacktestMetrics([
      signal('2024-01-05', 'AAA', 0.1),
      signal('2024-01-05', 'BBB', -0.05),
    ]);
    expect(result.total_signals).toBe(2);
  });

  it('computes win rate only over completed signals', () => {
    const result = calculateBacktestMetrics([
      signal('2024-01-05', 'AAA', 0.1), // win
      signal('2024-01-05', 'BBB', -0.05), // loss
      signal('2024-01-05', 'CCC', null), // not completed
    ]);
    expect(result.completed_signals).toBe(2);
    expect(result.win_rate_20d).toBe(50);
  });

  it('returns an empty summary for no signals', () => {
    const result = calculateBacktestMetrics([]);
    expect(result.total_signals).toBe(0);
    expect(result.completed_signals).toBe(0);
    expect(result.win_rate_20d).toBe(0);
  });
});
