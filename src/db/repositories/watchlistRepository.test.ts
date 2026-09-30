import { describe, it, expect, vi, beforeEach } from 'vitest';

const { watchlistMap, assetsMap, upsertMock, updateMock, deleteMock, tableAvailable, missingTables } =
  vi.hoisted(() => ({
    watchlistMap: new Map<string, any>(),
    assetsMap: new Map<string, any>(),
    upsertMock: vi.fn(),
    updateMock: vi.fn(),
    deleteMock: vi.fn(),
    tableAvailable: { value: true },
    missingTables: new Set<string>(),
  }));

vi.mock('../supabaseClient', () => ({
  dbClient: {
    supabase: {
      from: () => {
        // update()/upsert() are terminal; delete() returns a filter builder that
        // must be chainable (.eq/.in/.neq) before it resolves.
        const filterable = (runner: any) => {
          const builder: any = {
            eq: () => builder,
            in: () => builder,
            neq: () => builder,
            then: (resolve: any, reject: any) => Promise.resolve(runner()).then(resolve, reject),
          };
          return builder;
        };
        return {
          upsert: upsertMock,
          update: updateMock,
          delete: () => filterable(deleteMock),
        };
      },
    },
    isSupabaseConnected: true,
    missingTables,
    isTableAvailable: () => tableAvailable.value,
    handleDbError: vi.fn(),
    assertWriteOk: (table: string, op: string, error: any) => {
      if (!error) return;
      throw new Error(`[db] ${table}.${op} failed: ${error.message}`);
    },
    seedInMemoryState: () => {},
    watchlist: watchlistMap,
    assets: assetsMap,
  },
}));

vi.mock('./assetRepository', () => ({
  assetRepository: { upsert: vi.fn(async () => {}) },
}));

import { watchlistRepository } from './watchlistRepository';

const PGRST204 = {
  code: 'PGRST204',
  message: "Could not find the 'market_region' column of 'watchlist' in the schema cache",
};

describe('watchlistRepository write failure propagation', () => {
  beforeEach(() => {
    watchlistMap.clear();
    assetsMap.clear();
    missingTables.clear();
    tableAvailable.value = true;
    upsertMock.mockReset();
    updateMock.mockReset();
    deleteMock.mockReset();
  });

  it('throws instead of silently succeeding when insert hits PGRST204', async () => {
    upsertMock.mockResolvedValue({ error: PGRST204 });

    await expect(watchlistRepository.add({ ticker: 'AAPL' })).rejects.toThrow(/market_region/);

    expect(watchlistMap.has('AAPL')).toBe(false);
  });

  it('throws when remove fails and keeps the in-memory entry', async () => {
    watchlistMap.set('AAPL', { ticker: 'AAPL', name: 'AAPL', is_active: true });
    deleteMock.mockResolvedValue({ error: { code: '42501', message: 'row-level security' } });

    await expect(watchlistRepository.remove('AAPL')).rejects.toThrow(/delete failed/);

    expect(watchlistMap.has('AAPL')).toBe(true);
  });

  it('persists and returns the item when the insert succeeds', async () => {
    upsertMock.mockResolvedValue({ error: null });

    const added = await watchlistRepository.add({ ticker: 'AAPL', market_region: 'US' });

    expect(added.ticker).toBe('AAPL');
    expect(watchlistMap.get('AAPL')).toBeDefined();
  });

  it('falls back to in-memory only when the table is genuinely unavailable', async () => {
    tableAvailable.value = false;

    const added = await watchlistRepository.add({ ticker: 'MSFT' });

    expect(added.ticker).toBe('MSFT');
    expect(upsertMock).not.toHaveBeenCalled();
  });
});
