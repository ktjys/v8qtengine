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
  private CACHE_TTL_MS = 30 * 1000; // 30 seconds cache for live quotes
  private HISTORY_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache for historical bars
  /** 마지막 조회에서 실제 폴백(seed)으로 대체되었는지 여부 */
  private lastUsedFallback = false;

  /** true이면 최근 조회 중 하나라도 seed 폴백을 사용했음을 의미한다. */
  getHadFallback(): boolean {
    return this.lastUsedFallback;
  }

  resetFallbackFlag(): void {
    this.lastUsedFallback = false;
  }

  private getCached<T>(key: string, customTtl?: number): T | null {
    const entry = this.cache.get(key);
    const ttl = customTtl ?? this.CACHE_TTL_MS;
    if (entry && Date.now() - entry.timestamp < ttl) {
      return entry.data;
    }
    return null;
  }

  private setCache<T>(key: string, data: T): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  private extractQuoteFromChart(clean: string, meta: any, bars?: OHLCVBar[]): QuoteData | null {
    if (!meta || typeof (meta.regularMarketPrice ?? meta.previousClose) !== 'number') {
      return null;
    }

    const currentPrice =
      meta.regularMarketPrice ??
      meta.previousClose ??
      (bars && bars.length > 0 ? bars[bars.length - 1].close : 100);

    let changePercent = 0;
    let change = 0;

    if (typeof meta.regularMarketChangePercent === 'number') {
      changePercent = meta.regularMarketChangePercent;
      change =
        typeof meta.fulldayChange === 'number'
          ? meta.fulldayChange
          : (currentPrice * changePercent) / 100;
    } else if (typeof meta.fulldayChangePercent === 'number') {
      changePercent = meta.fulldayChangePercent;
      change =
        typeof meta.fulldayChange === 'number'
          ? meta.fulldayChange
          : (currentPrice * changePercent) / 100;
    } else if (typeof meta.previousClose === 'number' && meta.previousClose > 0) {
      change = currentPrice - meta.previousClose;
      changePercent = (change / meta.previousClose) * 100;
    } else if (bars && bars.length >= 2) {
      const lastClose = bars[bars.length - 1].close;
      const prevClose = bars[bars.length - 2].close;
      if (prevClose > 0) {
        change = lastClose - prevClose;
        changePercent = (change / prevClose) * 100;
      }
    }

    return {
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
  }

  async getQuote(ticker: string): Promise<QuoteData> {
    const clean = ticker.toUpperCase().trim();
    const cacheKey = `quote_${clean}`;
    const cached = this.getCached<QuoteData>(cacheKey, 60 * 1000);
    if (cached) return cached;

    // Check if we have historical bars cached from a recent getHistorical call
    const histCached = this.getCached<OHLCVBar[]>(`history_${clean}_1y_1d`);
    if (histCached && histCached.length > 0) {
      const lastBar = histCached[histCached.length - 1];
      const prevBar = histCached.length > 1 ? histCached[histCached.length - 2] : lastBar;
      const change = lastBar.close - prevBar.close;
      const changePercent = prevBar.close > 0 ? (change / prevBar.close) * 100 : 0;

      const derivedQuote: QuoteData = {
        ticker: clean,
        price: Math.round(lastBar.close * 100) / 100,
        change: Math.round(change * 100) / 100,
        changePercent: Math.round(changePercent * 100) / 100,
        currency: 'USD',
        exchange: 'US',
        shortName: clean,
        longName: clean,
        timestamp: lastBar.date,
      };
      this.setCache(cacheKey, derivedQuote);
      return derivedQuote;
    }

    // Fast 5d chart attempt if not in cache
    const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(clean)}?interval=1d&range=5d`;
    try {
      const res = await fetch(chartUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(2500),
      });

      if (res.ok) {
        const json = await res.json();
        const meta = json?.chart?.result?.[0]?.meta;
        const quote = this.extractQuoteFromChart(clean, meta);
        if (quote) {
          this.setCache(cacheKey, quote);
          return quote;
        }
      }
    } catch {}

    this.lastUsedFallback = true;
    return this.fallbackProvider.getQuote(clean);
  }

  async getHistorical(ticker: string, range = '1y', interval = '1d'): Promise<OHLCVBar[]> {
    const clean = ticker.toUpperCase().trim();
    const cacheKey = `history_${clean}_${range}_${interval}`;
    const cached = this.getCached<OHLCVBar[]>(cacheKey);
    if (cached) return cached;

    const urls = [
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(clean)}?interval=${interval}&range=${range}`,
      `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(clean)}?interval=${interval}&range=${range}`,
    ];

    const fetchHistoryFromUrl = async (url: string): Promise<OHLCVBar[]> => {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(3000),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const result = json?.chart?.result?.[0];
      if (!result) throw new Error('No chart result');
      const meta = result.meta;

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

      if (bars.length === 0) throw new Error('Empty bars');

      const extractedQuote = this.extractQuoteFromChart(clean, meta, bars);
      if (extractedQuote) {
        this.setCache(`quote_${clean}`, extractedQuote);
      }

      return bars;
    };

    for (const url of urls) {
      try {
        const bars = await fetchHistoryFromUrl(url);
        this.setCache(cacheKey, bars);
        return bars;
      } catch {}
    }

    // Try Stooq historical daily CSV fallback
    try {
      const stooqUrl = `https://stooq.com/q/d/l/?s=${encodeURIComponent(clean.toLowerCase())}.us&i=d`;
      const sRes = await fetch(stooqUrl, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(5000) });
      if (sRes.ok) {
        const csvText = await sRes.text();
        const lines = csvText.trim().split('\n');
        // Date,Open,High,Low,Close,Volume
        const bars: OHLCVBar[] = [];
        for (let i = 1; i < lines.length; i++) {
          const parts = lines[i].split(',');
          if (parts.length >= 5) {
            const date = parts[0];
            const open = parseFloat(parts[1]);
            const high = parseFloat(parts[2]);
            const low = parseFloat(parts[3]);
            const close = parseFloat(parts[4]);
            const volume = parts[5] ? parseFloat(parts[5]) : 0;
            if (!isNaN(close) && close > 0) {
              bars.push({
                date,
                open: isNaN(open) ? close : Math.round(open * 100) / 100,
                high: isNaN(high) ? close : Math.round(high * 100) / 100,
                low: isNaN(low) ? close : Math.round(low * 100) / 100,
                close: Math.round(close * 100) / 100,
                adjClose: Math.round(close * 100) / 100,
                volume: volume || 0,
              });
            }
          }
        }
        if (bars.length > 0) {
          let limit = 252;
          if (range === '6m') limit = 126;
          else if (range === '2y') limit = 504;
          else if (range === '5y') limit = 1260;
          const sliced = bars.slice(-limit);
          this.setCache(cacheKey, sliced);
          return sliced;
        }
      }
    } catch (sErr) {
      // ignore
    }

    console.warn(`[YahooFinanceProvider] getHistorical failed for ${clean}, falling back to Seed data`);
    this.lastUsedFallback = true;
    return this.fallbackProvider.getHistorical(clean, range, interval);
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
