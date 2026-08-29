import { describe, it, expect, vi, beforeEach } from 'vitest';

const { evalsMap } = vi.hoisted(() => ({ evalsMap: new Map<string, any>() }));

vi.mock('../supabaseClient', () => ({
  dbClient: {
    supabase: null,
    isSupabaseConnected: false,
    missingTables: new Set(['evaluations']),
    isTableAvailable: () => false,
    handleDbError: () => {},
    seedInMemoryState: () => {},
    evaluations: evalsMap,
    assets: new Map(),
  },
}));

import { evaluationRepository } from './evaluationRepository';
import { FullTickerEvaluation } from '../../types/v8';

function evalWithProvenance(
  ticker: string,
  opts: { signalGenerated?: boolean; decision?: string; provenance?: any } = {}
): FullTickerEvaluation {
  const decision = opts.decision ?? 'STRONG_OPPORTUNITY';
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
    opportunity: { opportunity_score: 80 }, // minimal
    risk: { risk_score: 20, risk_level: 'LOW' }, // minimal
    decision: {
      decision,
      actionable: decision.includes('OPPORTUNITY'),
    },
    signal_generated: opts.signalGenerated ?? decision.includes('OPPORTUNITY'),
    data_quality: undefined,
    provenance: opts.provenance,
  } as unknown as FullTickerEvaluation;
}

beforeEach(() => {
  evalsMap.clear();
});

describe('evaluationRepository (local cache, no Supabase)', () => {
  it('roundtrips provenance through saveAll/getAll', async () => {
    const provenance = {
      source: 'yahoo',
      isFallback: false,
      marketDataSource: 'yahoo',
      fundamentalDataSource: 'seed',
      classificationSource: 'auto',
      warnings: ['fundamentals sourced from seed baseline'],
    };
    const ev = evalWithProvenance('AAPL', { signalGenerated: false, provenance });
    await evaluationRepository.saveAll([ev]);
    const all = await evaluationRepository.getAll();
    const loaded = all.find((e) => e.ticker === 'AAPL');
    expect(loaded?.provenance).toEqual(provenance);
  });

  it('preserves explicit signal_generated=false even for OPPORTUNITY decision', async () => {
    // signal_generated must NOT be reconstructed from decision text.
    const ev = evalWithProvenance('MSFT', {
      signalGenerated: false,
      decision: 'STRONG_OPPORTUNITY',
    });
    await evaluationRepository.saveAll([ev]);
    const all = await evaluationRepository.getAll();
    const loaded = all.find((e) => e.ticker === 'MSFT');
    expect(loaded?.signal_generated).toBe(false);
  });

  it('roundtrips signal_generated=true', async () => {
    const ev = evalWithProvenance('NVDA', { signalGenerated: true });
    await evaluationRepository.saveAll([ev]);
    const all = await evaluationRepository.getAll();
    expect(all.find((e) => e.ticker === 'NVDA')?.signal_generated).toBe(true);
  });
});
