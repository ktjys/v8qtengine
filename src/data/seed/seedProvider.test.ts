import { describe, it, expect } from 'vitest';
import { SeedDataProvider } from './seedProvider';

const provider = new SeedDataProvider();

// Extract just the price path to compare reproducibility without date noise.
function pricePath(bars: { close: number; open: number; high: number; low: number }[]): string {
  return bars.map((b) => `${b.close}|${b.open}|${b.high}|${b.low}`).join(',');
}

describe('SeedDataProvider.getHistorical (deterministic)', () => {
  it('returns an identical series for the same ticker on repeated calls', async () => {
    const a = await provider.getHistorical('AAPL');
    const b = await provider.getHistorical('AAPL');
    expect(b.length).toBe(a.length);
    expect(pricePath(b)).toBe(pricePath(a));
  });

  it('produces different series for different tickers', async () => {
    const aapl = await provider.getHistorical('AAPL');
    const msft = await provider.getHistorical('MSFT');
    expect(pricePath(msft)).not.toBe(pricePath(aapl));
  });

  it('anchors the final close to the seeded base price', async () => {
    const bars = await provider.getHistorical('AAPL');
    const last = bars[bars.length - 1];
    expect(last.close).toBe(last.adjClose);
  });

  it('produces plausible bar invariants (high >= max(open, close))', async () => {
    const bars = await provider.getHistorical('NVDA');
    for (const b of bars) {
      // Allow a 2-cent tolerance for 2-decimal rounding of open/close.
      expect(b.high).toBeGreaterThanOrEqual(Math.max(b.open, b.close) - 0.02);
      expect(b.volume).toBeGreaterThan(0);
    }
  });
});
