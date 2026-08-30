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

  async getQuote(ticker: string): Promise<QuoteData> {
    const clean = ticker.toUpperCase().trim();
    const cacheKey = `quote_${clean}`;
    const cached = this.getCached<QuoteData>(cacheKey, 30 * 1000);
    if (cached) return cached;

    // 1. Try Yahoo Finance Chart API (query1 & query2)
    const chartUrls = [
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(clean)}?interval=1d&range=5d`,
      `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(clean)}?interval=1d&range=5d`,
    ];

    for (const url of chartUrls) {
      try {
        const res = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            Accept: 'application/json',
          },
        });

        if (res.ok) {
          const json = await res.json();
          const meta = json?.chart?.result?.[0]?.meta;
          if (meta && typeof (meta.regularMarketPrice ?? meta.previousClose) === 'number') {
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
          }
        }
      } catch (e) {
        // try next url
      }
    }

    // 2. Try Yahoo Finance Quote API v7 (query1 & query2)
    const quoteUrls = [
      `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(clean)}`,
      `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(clean)}`,
    ];

    for (const url of quoteUrls) {
      try {
        const res = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            Accept: 'application/json',
          },
        });

        if (res.ok) {
          const json = await res.json();
          const qRes = json?.quoteResponse?.result?.[0];
          if (qRes && typeof (qRes.regularMarketPrice ?? qRes.postMarketPrice ?? qRes.preMarketPrice) === 'number') {
            const currentPrice = qRes.regularMarketPrice ?? qRes.postMarketPrice ?? qRes.preMarketPrice;
            const change = qRes.regularMarketChange ?? 0;
            const changePercent = qRes.regularMarketChangePercent ?? 0;

            const quote: QuoteData = {
              ticker: clean,
              price: Math.round(currentPrice * 100) / 100,
              change: Math.round(change * 100) / 100,
              changePercent: Math.round(changePercent * 100) / 100,
              currency: qRes.currency || 'USD',
              exchange: qRes.fullExchangeName || 'US',
              shortName: qRes.shortName || clean,
              longName: qRes.longName || qRes.shortName || clean,
              fiftyTwoWeekHigh: qRes.fiftyTwoWeekHigh,
              fiftyTwoWeekLow: qRes.fiftyTwoWeekLow,
              timestamp: new Date().toISOString(),
            };

            this.setCache(cacheKey, quote);
            return quote;
          }
        }
      } catch (e) {
        // try next
      }
    }

    // 3. Try Stooq quote fallback
    try {
      const stooqUrl = `https://stooq.com/q/l/?s=${encodeURIComponent(clean.toLowerCase())}.us&f=sd2t2ohlcv&h&e=csv`;
      const sRes = await fetch(stooqUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (sRes.ok) {
        const csvText = await sRes.text();
        const lines = csvText.trim().split('\n');
        if (lines.length >= 2) {
          const parts = lines[1].split(',');
          // Symbol,Date,Time,Open,High,Low,Close,Volume
          if (parts.length >= 7) {
            const open = parseFloat(parts[3]);
            const close = parseFloat(parts[6]);
            if (!isNaN(close) && close > 0) {
              const change = !isNaN(open) && open > 0 ? close - open : 0;
              const changePercent = !isNaN(open) && open > 0 ? (change / open) * 100 : 0;
              const quote: QuoteData = {
                ticker: clean,
                price: Math.round(close * 100) / 100,
                change: Math.round(change * 100) / 100,
                changePercent: Math.round(changePercent * 100) / 100,
                currency: 'USD',
                exchange: 'US',
                shortName: clean,
                longName: clean,
                timestamp: parts[1] || new Date().toISOString(),
              };
              this.setCache(cacheKey, quote);
              return quote;
            }
          }
        }
      }
    } catch (sErr) {
      // ignore
    }

    console.warn(`[YahooFinanceProvider] getQuote failed for ${clean}, falling back to Seed data`);
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

    for (const url of urls) {
      try {
        const res = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            Accept: 'application/json',
          },
        });

        if (res.ok) {
          const json = await res.json();
          const result = json?.chart?.result?.[0];
          if (result) {
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

            if (bars.length > 0) {
              this.setCache(cacheKey, bars);
              return bars;
            }
          }
        }
      } catch (err) {
        // try next
      }
    }

    // Try Stooq historical daily CSV fallback
    try {
      const stooqUrl = `https://stooq.com/q/d/l/?s=${encodeURIComponent(clean.toLowerCase())}.us&i=d`;
      const sRes = await fetch(stooqUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
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
