import { OHLCVBar } from '../data/providers/types';
import { marketDataRepository } from '../db/repositories/marketDataRepository';
import { SeedDataProvider } from '../data/seed/seedProvider';
import { YahooFinanceProvider } from '../data/providers/yahooFinanceProvider';

export class HistoricalDataProvider {
  private yahooProvider = new YahooFinanceProvider();
  private seedProvider = new SeedDataProvider();

  async getHistoricalBarsForTicker(ticker: string, range = '2y'): Promise<OHLCVBar[]> {
    const clean = ticker.toUpperCase().trim();
    // 1. Try DB first
    const dbBars = await marketDataRepository.getBars(clean, 600);
    if (dbBars && dbBars.length >= 200) {
      return dbBars;
    }

    // 2. Fetch from Yahoo
    try {
      const bars = await this.yahooProvider.getHistorical(clean, range, '1d');
      if (bars.length >= 50) {
        await marketDataRepository.saveBars(clean, bars);
        return bars;
      }
    } catch (err) {
      console.warn(`[HistoricalDataProvider] Yahoo fetch failed for ${clean}, using seed fallback:`, (err as Error).message);
    }

    // 3. Fallback to Seed
    const seedBars = await this.seedProvider.getHistorical(clean, range, '1d');
    await marketDataRepository.saveBars(clean, seedBars, 'seed');
    return seedBars;
  }

  /**
   * Generates a Point-in-Time slice of bars up to index T, strictly prohibiting
   * access to bars at index T+1 and beyond.
   */
  getPointInTimeSlice(bars: OHLCVBar[], currentIndex: number): OHLCVBar[] {
    if (currentIndex < 0 || currentIndex >= bars.length) {
      throw new Error(`Index ${currentIndex} out of bounds for historical slice (length ${bars.length})`);
    }
    return bars.slice(0, currentIndex + 1);
  }

  /**
   * Extracts forward outcome prices at +5, +10, +20 trading days
   */
  getForwardOutcomes(
    bars: OHLCVBar[],
    currentIndex: number
  ): {
    entryPrice: number;
    return5d: number | null;
    return10d: number | null;
    return20d: number | null;
    maxDrawdown: number;
  } {
    const entryBar = bars[currentIndex];
    const entryPrice = entryBar.close;

    const bar5 = currentIndex + 5 < bars.length ? bars[currentIndex + 5] : null;
    const bar10 = currentIndex + 10 < bars.length ? bars[currentIndex + 10] : null;
    const bar20 = currentIndex + 20 < bars.length ? bars[currentIndex + 20] : null;

    const return5d = bar5 ? ((bar5.close - entryPrice) / entryPrice) * 100 : null;
    const return10d = bar10 ? ((bar10.close - entryPrice) / entryPrice) * 100 : null;
    const return20d = bar20 ? ((bar20.close - entryPrice) / entryPrice) * 100 : null;

    // Calculate maximum drawdown during next 20 bars
    let lowestPrice = entryPrice;
    const forwardWindow = Math.min(bars.length - 1, currentIndex + 20);
    for (let i = currentIndex + 1; i <= forwardWindow; i++) {
      if (bars[i].low < lowestPrice) {
        lowestPrice = bars[i].low;
      }
    }
    const maxDrawdown = entryPrice > 0 ? ((lowestPrice - entryPrice) / entryPrice) * 100 : 0;

    return {
      entryPrice,
      return5d: return5d !== null ? Math.round(return5d * 100) / 100 : null,
      return10d: return10d !== null ? Math.round(return10d * 100) / 100 : null,
      return20d: return20d !== null ? Math.round(return20d * 100) / 100 : null,
      maxDrawdown: Math.round(maxDrawdown * 100) / 100,
    };
  }
}

export const historicalDataProvider = new HistoricalDataProvider();
