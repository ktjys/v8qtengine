import { MarketDataProvider } from '../providers/marketDataProvider';
import { FundamentalData, NormalizedMarketData, OHLCVBar, QuoteData } from '../providers/types';
import { INITIAL_WATCHLIST_RAW } from './initialData';

// Deterministic PRNG (mulberry32) seeded from the ticker so the same ticker
// always produces the same synthetic bar series. Backtest reproducibility
// requires that `getHistorical(ticker)` returns an identical series on every
// call — never use Math.random() here.
function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function getDefaultSeedEndDate(): string {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

export class SeedDataProvider implements MarketDataProvider {
  readonly name = 'seed';

  async getQuote(ticker: string): Promise<QuoteData> {
    const seed = INITIAL_WATCHLIST_RAW.find((s) => s.ticker.toUpperCase() === ticker.toUpperCase());
    const price = seed ? seed.price : 100;
    const change = seed ? (seed.price * seed.change1d) / 100 : 0;
    const changePercent = seed ? seed.change1d : 0;

    return {
      ticker: ticker.toUpperCase(),
      price,
      change,
      changePercent,
      currency: 'USD',
      exchange: 'NASDAQ',
      shortName: seed?.name || ticker.toUpperCase(),
      longName: seed?.name || ticker.toUpperCase(),
      marketCap: seed?.metadata.marketCap || 10_000_000_000,
      timestamp: new Date().toISOString(),
    };
  }

  async getHistorical(ticker: string, range = '1y', interval = '1d', endDate?: string): Promise<OHLCVBar[]> {
    const clean = ticker.toUpperCase();
    const seed = INITIAL_WATCHLIST_RAW.find((s) => s.ticker.toUpperCase() === clean);
    const basePrice = seed ? seed.price : 100;
    const change1d = seed?.change1d ?? 0;

    const maxMasterBars = 1260;
    let targetBarsCount = 252;
    if (range === '1m') targetBarsCount = 22;
    else if (range === '3m') targetBarsCount = 63;
    else if (range === '6m') targetBarsCount = 126;
    else if (range === '1y') targetBarsCount = 252;
    else if (range === '2y') targetBarsCount = 504;
    else if (range === '5y' || range === 'all') targetBarsCount = 1260;

    // Use ticker + interval as seed so all ranges have identical underlying trajectory
    const rng = mulberry32(hashString(`${clean}:master_history:${interval}`));

    const anchorMs = endDate
      ? new Date(`${endDate}T00:00:00Z`).getTime()
      : new Date(`${getDefaultSeedEndDate()}T00:00:00Z`).getTime();

    // 1. Generate valid trading day dates (excluding weekends) going backward from anchorMs
    const tradingDates: string[] = [];
    let dayOffset = 0;
    while (tradingDates.length < maxMasterBars) {
      const d = new Date(anchorMs - dayOffset * 24 * 60 * 60 * 1000);
      const dayOfWeek = d.getUTCDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        tradingDates.push(d.toISOString().split('T')[0]);
      }
      dayOffset++;
    }
    // Reverse so tradingDates[0] is oldest, tradingDates[maxMasterBars-1] is latest (today)
    tradingDates.reverse();

    // 2. Generate prices backward from basePrice to guarantee smooth continuity and 0% discontinuity
    const closes = new Array<number>(maxMasterBars);
    const latestIdx = maxMasterBars - 1;
    closes[latestIdx] = basePrice;

    // Set yesterday's close according to known 1d change
    if (latestIdx >= 1) {
      const denom = 1 + (change1d / 100);
      closes[latestIdx - 1] = denom > 0 ? basePrice / denom : basePrice * 0.99;
    }

    // Step backward from latestIdx - 2 down to 0
    for (let i = latestIdx - 2; i >= 0; i--) {
      const randomShock = (rng() - 0.49) * 0.022;
      const prevClose = closes[i + 1] / (1 + randomShock);
      closes[i] = Math.max(0.5, prevClose);
    }

    // 3. Build OHLCV bars
    const masterBars: OHLCVBar[] = [];
    for (let i = 0; i < maxMasterBars; i++) {
      const date = tradingDates[i];
      const close = Math.round(closes[i] * 100) / 100;
      const prevC = i > 0 ? closes[i - 1] : close;
      
      const openRaw = i === latestIdx && prevC > 0 
        ? prevC * (1 + (rng() - 0.5) * 0.004)
        : close * (1 + (rng() - 0.5) * 0.008);
      const open = Math.round(openRaw * 100) / 100;

      const upper = Math.max(open, close);
      const lower = Math.min(open, close);
      const high = Math.round(upper * (1 + Math.abs(rng()) * 0.01) * 100) / 100;
      const low = Math.round(lower * (1 - Math.abs(rng()) * 0.01) * 100) / 100;
      const volume = Math.floor(1000000 + rng() * 5000000);

      masterBars.push({
        date,
        open,
        high: Math.max(high, open, close),
        low: Math.min(low, open, close),
        close,
        adjClose: close,
        volume,
        source: 'seed',
      });
    }

    return masterBars.slice(-targetBarsCount);
  }

  async getFundamentals(ticker: string): Promise<FundamentalData> {
    const seed = INITIAL_WATCHLIST_RAW.find((s) => s.ticker.toUpperCase() === ticker.toUpperCase());
    return {
      ticker: ticker.toUpperCase(),
      asOfDate: new Date().toISOString().split('T')[0],
      marketCap: seed?.metadata.marketCap || 10_000_000_000,
      revenueGrowthYoy: seed?.metadata.revenueGrowth,
      earningsGrowthYoy: seed?.metadata.earningsGrowth,
      operatingMargin: seed?.indicators.operatingMargin,
      freeCashFlowMargin: seed?.indicators.freeCashFlowMargin,
      trailingPe: seed?.metadata.trailingPE,
      forwardPe: seed?.metadata.forwardPE,
      psRatio: seed?.indicators.psRatio,
      pegRatio: seed?.indicators.pegRatio,
      beta: seed?.metadata.beta || 1.0,
      dividendYield: seed?.metadata.dividendYield,
      sector: seed?.metadata.sector,
      industry: seed?.metadata.industry,
      quoteType: seed?.metadata.quoteType || 'EQUITY',
    };
  }

  async getBenchmark(range = '1y'): Promise<OHLCVBar[]> {
    return this.getHistorical('SPY', range);
  }

  async getNormalizedMarketData(ticker: string, benchmarkBars?: OHLCVBar[]): Promise<NormalizedMarketData> {
    const clean = ticker.toUpperCase();
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
      source: 'seed',
    };
  }
}
