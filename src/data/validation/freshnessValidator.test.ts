import { describe, it, expect } from 'vitest';
import { evaluateDataQuality } from './freshnessValidator';
import { NormalizedMarketData } from '../providers/types';

function makeBars(count: number): any[] {
  const bars = [];
  const start = Date.UTC(2023, 0, 1);
  for (let i = 0; i < count; i++) {
    const d = new Date(start + i * 86400000).toISOString().split('T')[0];
    bars.push({ date: d, open: 100, high: 101, low: 99, close: 100, adjClose: 100, volume: 1000000 });
  }
  return bars;
}

function data(overrides: Partial<NormalizedMarketData> = {}): NormalizedMarketData {
  return {
    ticker: 'TEST',
    quote: {
      ticker: 'TEST',
      price: 100,
      change: 1,
      changePercent: 1,
      currency: 'USD',
      exchange: 'US',
      timestamp: new Date().toISOString(),
    },
    bars: makeBars(252),
    fundamentals: {
      ticker: 'TEST',
      asOfDate: '2024-01-01',
      marketCap: 50_000_000_000,
      revenueGrowthYoy: 0.2,
      earningsGrowthYoy: 0.15,
      operatingMargin: 0.3,
      trailingPe: 25,
    },
    fetchedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1h ago -> FRESH
    source: 'yahoo',
    ...overrides,
  };
}

describe('evaluateDataQuality', () => {
  it('scores 100 for complete equity data with full bars', () => {
    const report = evaluateDataQuality(data(), false);
    expect(report.data_quality_score).toBe(100);
    expect(report.has_fundamentals).toBe(true);
    expect(report.data_freshness).toBe('FRESH');
  });

  it('uses only market score for ETFs', () => {
    const report = evaluateDataQuality(data(), true);
    expect(report.data_quality_score).toBe(100);
    expect(report.has_fundamentals).toBe(false);
  });

  it('deducts from combined score when fundamentals are missing', () => {
    const d = data({
      fundamentals: { ticker: 'TEST', asOfDate: '2024-01-01' } as never,
    });
    // fund score 100-20(marketCap)-15(revenue)-15(eps)-10(margin)-10(pe) = 30
    // combined = round(65 + 30*0.35) = round(65+10.5) = 76
    const report = evaluateDataQuality(d, false);
    expect(report.data_quality_score).toBe(76);
    expect(report.has_fundamentals).toBe(false);
  });

  it('classifies freshness bands correctly', () => {
    const recent = evaluateDataQuality(data({ fetchedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString() }), false);
    expect(recent.data_freshness).toBe('RECENT');

    const stale = evaluateDataQuality(data({ fetchedAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString() }), false);
    expect(stale.data_freshness).toBe('STALE');
    expect(stale.data_warnings.length).toBeGreaterThan(0);

    const outdated = evaluateDataQuality(data({ fetchedAt: new Date(Date.now() - 100 * 60 * 60 * 1000).toISOString() }), false);
    expect(outdated.data_freshness).toBe('OUTDATED');
  });

  it('reports insufficient bars as a lower market score', () => {
    const d = data({ bars: makeBars(40) });
    // market score 100-30 = 70; fund 100 -> combined round(70*.65+100*.35)=round(45.5+35)=81
    const report = evaluateDataQuality(d, false);
    expect(report.data_quality_score).toBe(81);
    expect(report.data_warnings.some((w) => w.includes('OHLCV'))).toBe(true);
  });

  it('exposes bars count and source', () => {
    const report = evaluateDataQuality(data(), false);
    expect(report.bars_count).toBe(252);
    expect(report.source).toBe('yahoo');
    expect(report.last_updated).toBeDefined();
  });
});
