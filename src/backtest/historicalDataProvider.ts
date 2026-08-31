import { OHLCVBar } from '../data/providers/types';
import { marketDataRepository } from '../db/repositories/marketDataRepository';
import { SeedDataProvider } from '../data/seed/seedProvider';
import { YahooFinanceProvider } from '../data/providers/yahooFinanceProvider';

export class HistoricalDataProvider {
  private yahooProvider = new YahooFinanceProvider();
  private seedProvider = new SeedDataProvider();
  /** 마지막 getHistoricalBarsForTicker 호출에서 Seed 폴백을 사용했는지 여부 */
  private lastUsedSeed = false;

  /** true이면 직전 히스토리컬 조회가 Seed(합성) 폴백이었음을 의미한다. */
  getHadSeedFallback(): boolean {
    return this.lastUsedSeed;
  }

  resetSeedFallback(): void {
    this.lastUsedSeed = false;
  }

  async getHistoricalBarsForTicker(ticker: string, range = '2y', endDate?: string): Promise<OHLCVBar[]> {
    const clean = ticker.toUpperCase().trim();
    // 현재 조회의 폴백 상태를 초기화
    this.lastUsedSeed = false;

    // Determine minimum bars needed for requested range
    let minBarsNeeded = 50;
    let dbFetchLimit = 600;
    if (range === '6m') minBarsNeeded = 100;
    else if (range === '1y') minBarsNeeded = 200;
    else if (range === '2y') {
      minBarsNeeded = 400;
      dbFetchLimit = 700;
    } else if (range === '5y' || range === 'all') {
      minBarsNeeded = 900;
      dbFetchLimit = 1500;
    }

    // 1. Try DB first (only if DB has genuine non-seed bars with enough length)
    const dbBars = await marketDataRepository.getBars(clean, dbFetchLimit);
    const hasSeedBar = dbBars?.some((b) => b.source === 'seed');
    if (dbBars && dbBars.length >= minBarsNeeded && !hasSeedBar) {
      return dbBars;
    }

    // 2. Fetch from Yahoo (단, Yahoo 내부에서 seed 폴백된 경우 DB에 저장하지 않는다)
    try {
      if (this.yahooProvider.resetFallbackFlag) {
        this.yahooProvider.resetFallbackFlag();
      }
      const bars = await this.yahooProvider.getHistorical(clean, range, '1d');
      const usedFallback = !!this.yahooProvider.getHadFallback?.();
      if (bars.length >= 50 && !usedFallback) {
        await marketDataRepository.saveBars(clean, bars, 'yahoo');
        return bars;
      }
      if (bars.length >= 50 && usedFallback) {
        this.lastUsedSeed = true;
        return bars;
      }
    } catch (err) {
      console.warn(`[HistoricalDataProvider] Yahoo fetch failed for ${clean}, using seed fallback:`, (err as Error).message);
    }

    // 3. Fallback to Seed (결정적 재현을 위해 DB에 영속화하지 않는다)
    this.lastUsedSeed = true;
    const seedBars = await this.seedProvider.getHistorical(clean, range, '1d', endDate);
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
   * Extracts forward outcome prices at +5, +10, +20, +60, +120, +252 trading days.
   * Longer horizons capture the long-term-holder view (return252d needs ~1yr of
   * forward bars, so near-period-end signals return null).
   */
  getForwardOutcomes(
    bars: OHLCVBar[],
    currentIndex: number
  ): {
    entryPrice: number;
    return5d: number | null;
    return10d: number | null;
    return20d: number | null;
    return60d: number | null;
    return120d: number | null;
    return252d: number | null;
    exit60d?: number;
    exit120d?: number;
    exit252d?: number;
    maxAdverseExcursion: number;
  } {
    const entryBar = bars[currentIndex];
    const entryPrice = entryBar.close;

    const retAt = (n: number): { ret: number | null; exit?: number } => {
      const idx = currentIndex + n;
      if (idx >= bars.length) return { ret: null };
      const close = bars[idx].close;
      return { ret: Math.round(((close - entryPrice) / entryPrice) * 10000) / 100, exit: close };
    };

    const r5 = retAt(5);
    const r10 = retAt(10);
    const r20 = retAt(20);
    const r60 = retAt(60);
    const r120 = retAt(120);
    const r252 = retAt(252);

    // Max Adverse Excursion: entry 이후 최저가 기준 낙폭 (Portfolio MDD 아님)
    let lowestPrice = entryPrice;
    const forwardWindow = Math.min(bars.length - 1, currentIndex + 20);
    for (let i = currentIndex + 1; i <= forwardWindow; i++) {
      if (bars[i].low < lowestPrice) {
        lowestPrice = bars[i].low;
      }
    }
    const maxAdverseExcursion = entryPrice > 0 ? ((lowestPrice - entryPrice) / entryPrice) * 100 : 0;

    return {
      entryPrice,
      return5d: r5.ret,
      return10d: r10.ret,
      return20d: r20.ret,
      return60d: r60.ret,
      return120d: r120.ret,
      return252d: r252.ret,
      exit60d: r60.exit,
      exit120d: r120.exit,
      exit252d: r252.exit,
      maxAdverseExcursion: Math.round(maxAdverseExcursion * 100) / 100,
    };
  }
}

export const historicalDataProvider = new HistoricalDataProvider();
