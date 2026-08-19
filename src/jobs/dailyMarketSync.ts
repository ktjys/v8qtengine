import { watchlistRepository } from '../db/repositories/watchlistRepository';
import { MarketDataService } from '../data/marketDataService';
import { marketDataRepository } from '../db/repositories/marketDataRepository';
import { fundamentalsRepository } from '../db/repositories/fundamentalsRepository';

export async function runDailyMarketSync(): Promise<{ syncedCount: number; errors: string[] }> {
  const watchlist = await watchlistRepository.getActive();
  const service = new MarketDataService();
  const errors: string[] = [];
  let syncedCount = 0;

  for (const item of watchlist) {
    try {
      const processed = await service.processTicker(item.ticker);
      await marketDataRepository.saveBars(processed.ticker, processed.normalized.bars, processed.normalized.source);
      await fundamentalsRepository.save(processed.normalized.fundamentals, processed.normalized.source);
      syncedCount++;
    } catch (err) {
      errors.push(`${item.ticker}: ${(err as Error).message}`);
    }
  }

  return { syncedCount, errors };
}
