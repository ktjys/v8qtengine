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

  async getHistoricalBarsForTicker(ticker: string, range = '2y'): Promise<OHLCVBar[]> {
    const clean = ticker.toUpperCase().trim();
    // 현재 조회의 폴백 상태를 초기화
    this.lastUsedSeed = false;

    // 1. Try DB first
    const dbBars = await marketDataRepository.getBars(clean, 600);
    if (dbBars && dbBars.length >= 200) {
      // Seed 데이터가 DB에 영속화되어 있으면 이후 조회에서도 seed로 인식한다
      // (provenance 보존: getBars가 각 bar의 원본 source를 유지하므로 모두 seed인지 판별 가능)
      const hasSeedBar = dbBars.some((b) => b.source === 'seed');
      const allSeed = dbBars.every((b) => b.source === 'seed');
      if (hasSeedBar) {
        this.lastUsedSeed = true;
        console.warn(
          `[HistoricalDataProvider] ${clean} bars loaded from DB are seed-sourced (all=${allSeed}). Signals from seed data will be blocked.`
        );
      }
      return dbBars;
    }

    // 2. Fetch from Yahoo (단, Yahoo 내부에서 seed 폴백된 경우 DB에 저장하지 않는다)
    try {
      if (this.yahooProvider.resetFallbackFlag) {
        this.yahooProvider.resetFallbackFlag();
      }
      const bars = await this.yahooProvider.getHistorical(clean, range, '1d');
      const usedFallback = !!this.yahooProvider.getHadFallback?.();
      if (bars.length >= 50) {
        if (usedFallback) {
          // Yahoo 내부에서 seed로 폴백됐다면, DB 저장을 건너뛰고 seed 사용을 정직하게 기록한다
          this.lastUsedSeed = true;
        } else {
          await marketDataRepository.saveBars(clean, bars);
        }
        return bars;
      }
    } catch (err) {
      console.warn(`[HistoricalDataProvider] Yahoo fetch failed for ${clean}, using seed fallback:`, (err as Error).message);
    }

    // 3. Fallback to Seed (결정적 재현을 위해 DB에 영속화하지 않는다)
    this.lastUsedSeed = true;
    const seedBars = await this.seedProvider.getHistorical(clean, range, '1d');
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
    maxAdverseExcursion: number;
  } {
    const entryBar = bars[currentIndex];
    const entryPrice = entryBar.close;

    const bar5 = currentIndex + 5 < bars.length ? bars[currentIndex + 5] : null;
    const bar10 = currentIndex + 10 < bars.length ? bars[currentIndex + 10] : null;
    const bar20 = currentIndex + 20 < bars.length ? bars[currentIndex + 20] : null;

    const return5d = bar5 ? ((bar5.close - entryPrice) / entryPrice) * 100 : null;
    const return10d = bar10 ? ((bar10.close - entryPrice) / entryPrice) * 100 : null;
    const return20d = bar20 ? ((bar20.close - entryPrice) / entryPrice) * 100 : null;

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
      return5d: return5d !== null ? Math.round(return5d * 100) / 100 : null,
      return10d: return10d !== null ? Math.round(return10d * 100) / 100 : null,
      return20d: return20d !== null ? Math.round(return20d * 100) / 100 : null,
      maxAdverseExcursion: Math.round(maxAdverseExcursion * 100) / 100,
    };
  }
}

export const historicalDataProvider = new HistoricalDataProvider();
