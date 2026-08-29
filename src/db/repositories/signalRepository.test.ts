import { describe, it, expect, vi, beforeEach } from 'vitest';

const { sigsMap } = vi.hoisted(() => ({ sigsMap: new Map<string, any>() }));

vi.mock('../supabaseClient', () => ({
  dbClient: {
    supabase: null,
    isSupabaseConnected: false,
    missingTables: new Set(['signals', 'signal_outcomes']),
    isTableAvailable: () => false,
    handleDbError: () => {},
    seedInMemoryState: () => {},
    signals: sigsMap,
  },
}));

import { signalRepository } from './signalRepository';
import { SignalSnapshot } from '../../types/v8';

function sig(ticker: string, date: string, id?: string): SignalSnapshot {
  return {
    id: id || `sig-${ticker}-${date}`,
    ticker,
    signal_date: date,
    name: ticker,
    signal_price: 100,
    strategy_type: 'established_growth',
    opportunity_score: 80,
    risk_level: 'LOW',
    risk_score: 20,
    decision: 'STRONG_OPPORTUNITY',
    signal_confidence: 0.9,
    classification_confidence: 0.9,
    technical_score: 80,
    momentum_score: 80,
    fundamental_score: 70,
    valuation_score: 70,
    rsi: 55,
    drawdown: -5,
    components: { weights: {}, risk_reasons: [], decision_reason: '' },
    status: 'ACTIVE',
    return_5d: null,
    return_10d: null,
    return_20d: null,
    current_return: 0,
    is_closed: false,
  } as unknown as SignalSnapshot;
}

beforeEach(() => {
  sigsMap.clear();
});

describe('signalRepository (local cache, no Supabase)', () => {
  it('reuses id for an identical ticker+signal_date on save', async () => {
    const existing = sig('AAPL', '2024-01-05');
    await signalRepository.save(existing);
    await signalRepository.save(sig('AAPL', '2024-01-05', 'different-id'));
    expect(sigsMap.size).toBe(1);
    expect(sigsMap.get('different-id')).toBeUndefined();
  });

  it('getAll sorts descending by signal_date and dedups keys', async () => {
    await signalRepository.save(sig('AAPL', '2024-01-05'));
    await signalRepository.save(sig('AAPL', '2024-01-10'));
    await signalRepository.save(sig('MSFT', '2024-01-06'));
    const all = await signalRepository.getAll();
    expect(all.map((s) => `${s.ticker}_${s.signal_date}`)).toEqual([
      'AAPL_2024-01-10',
      'MSFT_2024-01-06',
      'AAPL_2024-01-05',
    ]);
  });

  it('updateOutcome mutates returns and closing state', async () => {
    const s = sig('AAPL', '2024-01-05');
    await signalRepository.save(s);
    const updated = await signalRepository.updateOutcome(s.id, {
      return_5d: 2.1,
      return_20d: 5.5,
      is_closed: true,
    });
    expect(updated?.return_20d).toBe(5.5);
    expect(updated?.is_closed).toBe(true);
    expect(updated?.return_5d).toBe(2.1);
  });

  it('updateOutcome returns null for an unknown id', async () => {
    const updated = await signalRepository.updateOutcome('nope', { return_20d: 1 });
    expect(updated).toBeNull();
  });

  it('saveSignals persists all and updates outcomes where present', async () => {
    const withOutcome = sig('AAPL', '2024-01-05', 'sig-a');
    withOutcome.return_20d = 4.2;
    const withoutOutcome = sig('MSFT', '2024-01-06', 'sig-b');
    const count = await signalRepository.saveSignals([withOutcome, withoutOutcome]);
    expect(count).toBe(2);
    expect(sigsMap.get('sig-a')?.return_20d).toBe(4.2);
    expect(sigsMap.get('sig-b')?.return_20d).toBeNull();
  });
});
