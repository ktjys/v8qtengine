import { describe, it, expect, vi, beforeEach } from 'vitest';

const { fundsMap } = vi.hoisted(() => ({ fundsMap: new Map<string, any>() }));

vi.mock('../supabaseClient', () => ({
  dbClient: {
    supabase: null,
    isSupabaseConnected: false,
    missingTables: new Set(['fundamentals']),
    isTableAvailable: () => false,
    handleDbError: () => {},
    fundamentals: fundsMap,
  },
}));

import { fundamentalsRepository } from './fundamentalsRepository';
import { FundamentalData } from '../../data/providers/types';

function data(ticker: string, asOfDate: string, growth = 0.2): FundamentalData {
  return {
    ticker,
    asOfDate,
    revenueGrowthYoy: growth,
    earningsGrowthYoy: 0.1,
    operatingMargin: 0.3,
    freeCashFlowMargin: 0.2,
    marketCap: 50_000_000_000,
    trailingPe: 25,
    forwardPe: 22,
    psRatio: 5,
    pegRatio: 1.2,
    quoteType: 'EQUITY',
  } as unknown as FundamentalData;
}

beforeEach(() => {
  fundsMap.clear();
});

describe('fundamentalsRepository (local cache, no Supabase)', () => {
  it('returns latest record by as_of_date', async () => {
    await fundamentalsRepository.save(data('AAPL', '2024-01-01', 0.1), 'yahoo');
    await fundamentalsRepository.save(data('aapl', '2024-01-10', 0.3), 'yahoo');
    const latest = await fundamentalsRepository.getLatest('AAPL');
    expect(latest?.as_of_date).toBe('2024-01-10');
    expect(latest?.revenue_growth).toBe(0.3);
  });

  it('getAsOf returns only the latest record at or before the evaluation date', async () => {
    await fundamentalsRepository.save(data('AAPL', '2024-01-01', 0.1));
    await fundamentalsRepository.save(data('AAPL', '2024-01-10', 0.3));
    // forward-looking reference after the evaluation date must be excluded
    const rec = await fundamentalsRepository.getAsOf('AAPL', '2024-01-05');
    expect(rec?.as_of_date).toBe('2024-01-01');
  });

  it('getAsOf returns null when no record precedes the evaluation date', async () => {
    await fundamentalsRepository.save(data('AAPL', '2024-01-10', 0.3));
    const rec = await fundamentalsRepository.getAsOf('AAPL', '2024-01-05');
    expect(rec).toBeNull();
  });

  it('getHistoryAsOf returns all records up to the date in ascending order', async () => {
    await fundamentalsRepository.save(data('AAPL', '2024-01-01'));
    await fundamentalsRepository.save(data('AAPL', '2024-01-05'));
    await fundamentalsRepository.save(data('AAPL', '2024-01-10')); // future
    const history = await fundamentalsRepository.getHistoryAsOf('AAPL', '2024-01-06');
    expect(history.map((h) => h.as_of_date)).toEqual(['2024-01-01', '2024-01-05']);
  });

  it('normalizes ticker to uppercase trimmed', async () => {
    await fundamentalsRepository.save(data('  aapl ', '2024-01-01'));
    const rec = await fundamentalsRepository.getLatest('AAPL');
    expect(rec?.ticker).toBe('AAPL');
  });

  it('returns null from getLatest when nothing exists', async () => {
    const rec = await fundamentalsRepository.getLatest('NOPE');
    expect(rec).toBeNull();
  });
});
