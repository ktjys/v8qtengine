import { describe, it, expect, vi, beforeEach } from 'vitest';

const { snapsMap, clsMap } = vi.hoisted(() => ({
  snapsMap: new Map<string, any>(),
  clsMap: new Map<string, any>(),
}));

vi.mock('../supabaseClient', () => ({
  dbClient: {
    supabase: null,
    isSupabaseConnected: false,
    missingTables: new Set(['classification_snapshot']),
    isTableAvailable: () => false,
    handleDbError: () => {},
    classifications: clsMap,
    classificationSnapshots: snapsMap,
  },
}));

import { classificationRepository } from './classificationRepository';
import { AssetClassification } from '../../types/v8';

function manualOverride(ticker: string, effectiveDate: string): AssetClassification {
  return {
    ticker,
    asset_type: 'equity',
    strategy_type: 'speculative',
    confidence: 1.0,
    classification_source: 'manual',
    reason: 'test override',
    classified_at: `${effectiveDate}T00:00:00.000Z`,
    updated_at: `${effectiveDate}T00:00:00.000Z`,
    effective_date: effectiveDate,
  };
}

beforeEach(() => {
  snapsMap.clear();
  clsMap.clear();
});

describe('classificationRepository PIT (local cache, no Supabase)', () => {
  it('returns the override only on dates at/after its effective_date', async () => {
    await classificationRepository.save(manualOverride('AAPL', '2024-06-01'));

    // Before the override took effect -> null (auto classification should be used)
    expect(await classificationRepository.getAsOf('AAPL', '2024-03-15')).toBeNull();

    // On the effective date and after -> override applies
    const on = await classificationRepository.getAsOf('AAPL', '2024-06-01');
    expect(on?.strategy_type).toBe('speculative');
    expect(on?.classification_source).toBe('manual');

    const after = await classificationRepository.getAsOf('AAPL', '2025-01-10');
    expect(after?.strategy_type).toBe('speculative');
  });

  it('picks the most recent override at or before the date', async () => {
    await classificationRepository.save(manualOverride('MSFT', '2024-02-01'));
    await classificationRepository.save({
      ...manualOverride('MSFT', '2024-08-15'),
      strategy_type: 'established_growth',
    });

    const early = await classificationRepository.getAsOf('MSFT', '2024-05-01');
    expect(early?.strategy_type).toBe('speculative');

    const late = await classificationRepository.getAsOf('MSFT', '2024-09-01');
    expect(late?.strategy_type).toBe('established_growth');
  });

  it('returns null for a ticker with no override ever', async () => {
    expect(await classificationRepository.getAsOf('TSLA', '2024-06-01')).toBeNull();
  });

  it('getCurrent returns the latest snapshot regardless of date', async () => {
    await classificationRepository.save(manualOverride('NVDA', '2024-03-01'));
    const current = classificationRepository.getCurrent('NVDA');
    expect(current?.strategy_type).toBe('speculative');
  });

  it('getHistoryAsOf returns snapshots in ascending effective_date order', async () => {
    await classificationRepository.save(manualOverride('NVDA', '2024-06-01'));
    await classificationRepository.save(manualOverride('NVDA', '2024-01-01'));
    await classificationRepository.save(manualOverride('NVDA', '2024-09-01'));

    const all = await classificationRepository.getHistoryAsOf('NVDA');
    expect(all).toHaveLength(3);
    expect(all[0].effective_date).toBe('2024-01-01');
    expect(all[1].effective_date).toBe('2024-06-01');
    expect(all[2].effective_date).toBe('2024-09-01');

    const cutoff = await classificationRepository.getHistoryAsOf('NVDA', '2024-06-15');
    expect(cutoff).toHaveLength(2);
    expect(cutoff[1].effective_date).toBe('2024-06-01');
  });
});
