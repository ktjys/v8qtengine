import { describe, it, expect } from 'vitest';
import { classifyAsset, RawYahooMetadata } from './classificationEngine';
import { AssetClassification } from '../types/v8';

function raw(overrides: Partial<RawYahooMetadata> = {}): RawYahooMetadata {
  return { quoteType: 'EQUITY', beta: 1.0, revenueGrowth: 0.1, marketCap: 5_000_000_000, ...overrides };
}

describe('classifyAsset', () => {
  it('preserves a manual override classification', () => {
    const existing: AssetClassification = {
      ticker: 'TEST',
      asset_type: 'equity',
      strategy_type: 'established_growth',
      confidence: 0.95,
      classification_source: 'manual',
      reason: 'manual',
      classified_at: '2024-01-01T00:00:00.000Z',
      updated_at: '2024-01-01T00:00:00.000Z',
    };
    const result = classifyAsset('TEST', raw(), existing);
    expect(result.strategy_type).toBe('established_growth');
    expect(result.classification_source).toBe('manual');
    expect(result.updated_at > existing.updated_at).toBe(true);
  });

  it('classifies broad market ETF by ticker', () => {
    const r = classifyAsset('VOO', raw({ quoteType: 'ETF' }));
    expect(r.asset_type).toBe('etf');
    expect(r.strategy_type).toBe('broad_market_etf');
  });

  it('classifies growth ETF by ticker', () => {
    const r = classifyAsset('QQQ', raw({ quoteType: 'ETF' }));
    expect(r.asset_type).toBe('etf');
    expect(r.strategy_type).toBe('growth_etf');
  });

  it('detects ETF from the name', () => {
    const r = classifyAsset('XXXX', raw({ quoteType: 'EQUITY', longName: 'Some VANGUARD Fund' }));
    expect(r.asset_type).toBe('etf');
  });

  it('classifies megacap low-beta as quality', () => {
    const r = classifyAsset('TEST', raw({ marketCap: 600_000_000_000, beta: 1.0 }));
    expect(r.strategy_type).toBe('quality');
  });

  it('classifies largecap high-growth as established_growth', () => {
    const r = classifyAsset('TEST', raw({ marketCap: 200_000_000_000, beta: 1.5, revenueGrowth: 0.3 }));
    expect(r.strategy_type).toBe('established_growth');
  });

  it('classifies very high beta as speculative', () => {
    const r = classifyAsset('TEST', raw({ beta: 2.5, marketCap: 50_000_000_000 }));
    expect(r.strategy_type).toBe('speculative');
  });

  it('falls back to general_equity for a plain stock', () => {
    const r = classifyAsset('TEST', raw());
    expect(r.strategy_type).toBe('general_equity');
  });
});
