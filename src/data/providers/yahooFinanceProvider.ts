import { MarketDataProvider } from './marketDataProvider';
import { FundamentalData, NormalizedMarketData, OHLCVBar, QuoteData } from './types';
import { SeedDataProvider } from '../seed/seedProvider';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export class YahooFinanceProvider implements MarketDataProvider {
  readonly name = 'yahoo';
  private fallbackProvider = new SeedDataProvider();
  private cache: Map<string, CacheEntry<any>> = new Map();
  private CACHE_TTL_MS = 60 * 1000 * 5; // 5 minutes cache

  private getCached<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (entry && Date.now() - entry.timestamp < this.CACHE_TTL_MS) {
      return entry.data;
    }
    return null;
  }

  private setCache<T>(key: string, data: T): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  async getQuote(ticker: string): Promise<QuoteData> {
    const clean = ticker.toUpperCase().trim();
    const cacheKey = `quote_${clean}`;
    const cached = this.getCached<QuoteData>(cacheKey);
    if (cached) return cached;

    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(clean)}?interval=1d&range=5d`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'application/json',
        },
      });

      if (!res.ok) {
        throw new Error(`Yahoo API status: ${res.status}`);
      }

      const json = await res.json();
      const meta = json?.chart?.result?.[0]?.meta;
      if (!meta) {
        throw new Error('No chart meta returned from Yahoo');
      }

      const currentPrice = meta.regularMarketPrice ?? meta.previousClose ?? 100;
      const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? currentPrice;
      const change = currentPrice - prevClose;
      const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;

      const quote: QuoteData = {
        ticker: clean,
        price: Math.round(currentPrice * 100) / 100,
        change: Math.round(change * 100) / 100,
        changePercent: Math.round(changePercent * 100) / 100,
        currency: meta.currency || 'USD',
        exchange: meta.exchangeName || 'US',
        shortName: meta.shortName || meta.symbol || clean,
        longName: meta.longName || meta.shortName || clean,
        fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh,
        fiftyTwoWeekLow: meta.fiftyTwoWeekLow,
        timestamp: new Date().toISOString(),
      };

      this.setCache(cacheKey, quote);
      return quote;
    } catch (err) {
      console.warn(`[YahooFinanceProvider] getQuote failed for ${clean}, falling back to Seed data:`, (err as Error).message);
      return this.fallbackProvider.getQuote(clean);
    }
  }

  async getHistorical(ticker: string, range = '1y', interval = '1d'): Promise<OHLCVBar[]> {
    const clean = ticker.toUpperCase().trim();
    const cacheKey = `history_${clean}_${range}_${interval}`;
    const cached = this.getCached<OHLCVBar[]>(cacheKey);
    if (cached) return cached;

    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(clean)}?interval=${interval}&range=${range}`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Accept: 'application/json',
        },
      });

      if (!res.ok) {
        throw new Error(`Yahoo chart API status: ${res.status}`);
      }

      const json = await res.json();
      const result = json?.chart?.result?.[0];
      if (!result) {
        throw new Error('Empty historical data result from Yahoo');
      }

      const timestamps: number[] = result.timestamp || [];
      const quoteObj = result.indicators?.quote?.[0] || {};
      const adjCloseArr: number[] = result.indicators?.adjclose?.[0]?.adjclose || quoteObj.close || [];

      const bars: OHLCVBar[] = [];
      for (let i = 0; i < timestamps.length; i++) {
        const close = quoteObj.close?.[i];
        const open = quoteObj.open?.[i] ?? close;
        const high = quoteObj.high?.[i] ?? close;
        const low = quoteObj.low?.[i] ?? close;
        const volume = quoteObj.volume?.[i] ?? 0;
        const adjClose = adjCloseArr[i] ?? close;

        if (close !== null && close !== undefined && !isNaN(close)) {
          const date = new Date(timestamps[i] * 1000).toISOString().split('T')[0];
          bars.push({
            date,
            open: Math.round(open * 100) / 100,
            high: Math.round(high * 100) / 100,
            low: Math.round(low * 100) / 100,
            close: Math.round(close * 100) / 100,
            adjClose: Math.round(adjClose * 100) / 100,
            volume: volume || 0,
          });
        }
      }

      if (bars.length === 0) {
        throw new Error('Parsed 0 valid OHLCV bars from Yahoo response');
      }

      this.setCache(cacheKey, bars);
      return bars;
    } catch (err) {
      console.warn(`[YahooFinanceProvider] getHistorical failed for ${clean}, falling back to Seed data:`, (err as Error).message);
      return this.fallbackProvider.getHistorical(clean, range, interval);
    }
  }

  async getFundamentals(ticker: string): Promise<FundamentalData> {
    const clean = ticker.toUpperCase().trim();
    const cacheKey = `fundamentals_${clean}`;
    const cached = this.getCached<FundamentalData>(cacheKey);
    if (cached) return cached;

    try {
      // Use fallback provider as baseline and enrich
      const baseline = await this.fallbackProvider.getFundamentals(clean);
      this.setCache(cacheKey, baseline);
      return baseline;
    } catch (err) {
      return this.fallbackProvider.getFundamentals(clean);
    }
  }

  async getBenchmark(range = '1y'): Promise<OHLCVBar[]> {
    return this.getHistorical('SPY', range);
  }

  async getNormalizedMarketData(ticker: string, benchmarkBars?: OHLCVBar[]): Promise<NormalizedMarketData> {
    const clean = ticker.toUpperCase().trim();
    const quote = await this.getQuote(clean);
    const bars = await this.getHistorical(clean);
    const fundamentals = await this.getFundamentals(clean);
    const bench = benchmarkBars || (await this.getBenchmark());

    return {
      ticker: clean,
      quote,
      bars,
      fundamentals,
      benchmarkBars: bench,
      fetchedAt: new Date().toISOString(),
      source: 'yahoo',
    };
  }
}
