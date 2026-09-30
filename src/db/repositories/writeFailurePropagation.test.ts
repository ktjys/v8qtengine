import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  classifications,
  classificationSnapshots,
  evaluations,
  signals,
  marketDataDaily,
  upsertMock,
  insertMock,
  deleteMock,
  availableTables,
  loggedErrors,
} = vi.hoisted(() => ({
  classifications: new Map<string, any>(),
  classificationSnapshots: new Map<string, any>(),
  evaluations: new Map<string, any>(),
  signals: new Map<string, any>(),
  marketDataDaily: new Map<string, any>(),
  upsertMock: vi.fn(),
  insertMock: vi.fn(),
  deleteMock: vi.fn(),
  availableTables: new Set<string>(),
  loggedErrors: [] as string[],
}));

vi.mock('../supabaseClient', () => ({
  dbClient: {
    supabase: {
      from: (table: string) => {
        const filterable = (runner: any) => {
          const builder: any = {
            eq: () => builder,
            in: () => builder,
            neq: () => builder,
            select: () => builder,
            maybeSingle: () => Promise.resolve({ data: null, error: null }),
            then: (resolve: any, reject: any) => Promise.resolve(runner()).then(resolve, reject),
          };
          return builder;
        };
        return {
          upsert: (payload: any, opts?: any) => upsertMock(table, payload, opts),
          insert: (payload: any) => insertMock(table, payload),
          update: (payload: any) => filterable(() => ({ error: null })),
          delete: () => filterable(() => deleteMock(table)),
        };
      },
    },
    isSupabaseConnected: true,
    missingTables: new Set<string>(),
    isTableAvailable: (table: string) => availableTables.has(table),
    // Mirrors the real client: handleDbError records, assertWriteOk records then throws
    // a tagged error so an enclosing catch can rethrow without logging it twice.
    handleDbError: (table: string, op: string, error: any) => {
      if (!error) return;
      loggedErrors.push(`${table}.${op}`);
    },
    assertWriteOk: (table: string, op: string, error: any) => {
      if (!error) return;
      loggedErrors.push(`${table}.${op}`);
      const failure = new Error(`[db] ${table}.${op} failed: ${error.message}`);
      (failure as any).loggedByAssertWriteOk = true;
      throw failure;
    },
    isLoggedWriteError: (err: any) => err?.loggedByAssertWriteOk === true,
    seedInMemoryState: () => {},
    classifications,
    classificationSnapshots,
    evaluations,
    signals,
    market_data_daily: marketDataDaily,
    assets: new Map(),
  },
}));

vi.mock('./assetRepository', () => ({
  assetRepository: { upsert: vi.fn(async () => {}), upsertBatch: vi.fn(async () => {}) },
}));

import { classificationRepository } from './classificationRepository';
import { evaluationRepository } from './evaluationRepository';
import { signalRepository } from './signalRepository';
import { marketDataRepository } from './marketDataRepository';
import { FullTickerEvaluation, AssetClassification, SignalSnapshot } from '../../types/v8';
import { OHLCVBar } from '../../data/providers/types';

const SCHEMA_DRIFT = {
  code: 'PGRST204',
  message: "Could not find the 'market_region' column in the schema cache",
};

function fullEvaluation(ticker: string): FullTickerEvaluation {
  return {
    ticker,
    name: ticker,
    price: 100,
    change1d: 1.2,
    evaluated_at: '2024-01-05T00:00:00.000Z',
    classification: {
      ticker,
      asset_type: 'equity',
      strategy_type: 'established_growth',
      confidence: 0.9,
      classification_source: 'auto',
      reason: '',
      classified_at: '2024-01-05T00:00:00.000Z',
      updated_at: '2024-01-05T00:00:00.000Z',
    },
    opportunity: { opportunity_score: 80 },
    risk: { risk_score: 40, risk_level: 'LOW' },
    decision: { decision: 'STRONG_OPPORTUNITY', confidence: 0.8 },
  } as unknown as FullTickerEvaluation;
}

function manualOverride(ticker: string): AssetClassification {
  return {
    ticker,
    asset_type: 'equity',
    strategy_type: 'speculative',
    confidence: 1,
    classification_source: 'manual',
    reason: 'test override',
    classified_at: '2024-01-05T00:00:00.000Z',
    updated_at: '2024-01-05T00:00:00.000Z',
    effective_date: '2024-01-05',
  } as AssetClassification;
}

function signal(ticker: string, date: string): SignalSnapshot {
  return {
    id: `sig-${ticker}-${date}`,
    ticker,
    signal_date: date,
    name: ticker,
    signal_price: 100,
    opportunity_score: 80,
    risk_score: 40,
    risk_level: 'LOW',
    decision: 'BUY',
    signal_confidence: 0.8,
    technical_score: 80,
    momentum_score: 80,
    fundamental_score: 80,
    valuation_score: 80,
    status: 'ACTIVE',
    return_5d: null,
    return_10d: null,
    return_20d: null,
    components: { weights: {}, decision_reason: '', risk_reasons: [] },
  } as unknown as SignalSnapshot;
}

function bar(tradeDate: string): OHLCVBar {
  return {
    date: tradeDate,
    open: 1,
    high: 2,
    low: 0.5,
    close: 1.5,
    volume: 100,
  } as unknown as OHLCVBar;
}

beforeEach(() => {
  classifications.clear();
  classificationSnapshots.clear();
  evaluations.clear();
  signals.clear();
  marketDataDaily.clear();
  availableTables.clear();
  loggedErrors.length = 0;
  upsertMock.mockReset();
  insertMock.mockReset();
  deleteMock.mockReset();
  upsertMock.mockResolvedValue({ error: null });
  insertMock.mockResolvedValue({ error: null });
  deleteMock.mockResolvedValue({ error: null });
});

describe('classificationRepository.save', () => {
  it('throws when the upsert fails instead of reporting success', async () => {
    availableTables.add('classification_snapshots');
    upsertMock.mockResolvedValue({ error: SCHEMA_DRIFT });

    await expect(classificationRepository.save(manualOverride('AAPL'))).rejects.toThrow(/classification_snapshots\.save failed/);
  });

  it('leaves in-memory state untouched when the DB write fails', async () => {
    availableTables.add('classification_snapshots');
    upsertMock.mockResolvedValue({ error: SCHEMA_DRIFT });

    await expect(classificationRepository.save(manualOverride('AAPL'))).rejects.toThrow();

    expect(classifications.has('AAPL')).toBe(false);
    expect(classificationSnapshots.has('AAPL_2024-01-05')).toBe(false);
  });

  it('updates in-memory state only after a successful write', async () => {
    availableTables.add('classification_snapshots');

    await classificationRepository.save(manualOverride('AAPL'));

    expect(classifications.get('AAPL')).toBeDefined();
    expect(classificationSnapshots.get('AAPL_2024-01-05')).toBeDefined();
  });
});

describe('evaluationRepository.saveAll', () => {
  it('throws when the preceding delete fails', async () => {
    availableTables.add('evaluations');
    deleteMock.mockResolvedValue({ error: { code: '42501', message: 'row-level security' } });

    await expect(evaluationRepository.saveAll([fullEvaluation('AAPL')])).rejects.toThrow(
      /evaluations\.delete before saveAll failed/,
    );
  });

  it('does not insert after a failed delete, which would duplicate rows', async () => {
    availableTables.add('evaluations');
    deleteMock.mockResolvedValue({ error: { code: '42501', message: 'row-level security' } });

    await expect(evaluationRepository.saveAll([fullEvaluation('AAPL')])).rejects.toThrow();

    expect(insertMock).not.toHaveBeenCalled();
  });

  it('throws when the insert fails', async () => {
    availableTables.add('evaluations');
    insertMock.mockResolvedValue({ error: SCHEMA_DRIFT });

    await expect(evaluationRepository.saveAll([fullEvaluation('AAPL')])).rejects.toThrow(/evaluations\.saveAll failed/);
  });

  it('reports each failure exactly once, not once per catch layer', async () => {
    availableTables.add('evaluations');
    insertMock.mockResolvedValue({ error: SCHEMA_DRIFT });

    await expect(evaluationRepository.saveAll([fullEvaluation('AAPL')])).rejects.toThrow();

    expect(loggedErrors.filter((e) => e === 'evaluations.saveAll')).toHaveLength(1);
  });
});

describe('signalRepository.write failure propagation', () => {
  it('throws when a signal batch chunk fails', async () => {
    availableTables.add('signals');
    upsertMock.mockResolvedValue({ error: SCHEMA_DRIFT });

    await expect(signalRepository.saveSignals([signal('AAPL', '2024-01-05')])).rejects.toThrow(
      /signals\.saveSignalsBatch failed/,
    );
  });

  it('throws when a signal outcome chunk fails', async () => {
    availableTables.add('signals');
    availableTables.add('signal_outcomes');
    upsertMock
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValue({ error: { code: '42501', message: 'row-level security' } });

    const withOutcome = { ...signal('AAPL', '2024-01-05'), return_5d: 3, return_20d: 8 };

    await expect(signalRepository.saveSignals([withOutcome as SignalSnapshot])).rejects.toThrow(
      /signal_outcomes\.saveSignalsBatch failed/,
    );
  });
});

describe('marketDataRepository.saveBars batch tolerance', () => {
  it('keeps writing later chunks after one fails, so a batch job is not aborted', async () => {
    availableTables.add('market_data_daily');
    upsertMock
      .mockResolvedValueOnce({ error: { code: '42501', message: 'row-level security' } })
      .mockResolvedValue({ error: null });

    const bars = Array.from({ length: 400 }, (_, i) => bar(`2024-01-${String((i % 28) + 1).padStart(2, '0')}`));

    await expect(marketDataRepository.saveBars('AAPL', bars)).resolves.toBeGreaterThan(0);

    expect(upsertMock).toHaveBeenCalledTimes(2);
    expect(loggedErrors.some((e) => e.startsWith('market_data_daily.upsert batch'))).toBe(true);
  });
});
