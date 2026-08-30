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
    const bars: OHLCVBar[] = [];

    // Generate synthetic daily bars with realistic drift and volatility
    // Generate a long master series (5y: ~1260 bars) deterministically seeded by ticker + interval.
    // This guarantees that 6m, 1y, 2y, and 5y all share the exact same price history and anchor.
    const maxMasterBars = 1260;
    let targetBarsCount = 252;
    if (range === '1m') targetBarsCount = 22;
    else if (range === '3m') targetBarsCount = 63;
    else if (range === '6m') targetBarsCount = 126;
    else if (range === '1y') targetBarsCount = 252;
    else if (range === '2y') targetBarsCount = 504;
    else if (range === '5y' || range === 'all') targetBarsCount = 1260;

    // Use ticker + interval as seed so 6m, 1y, 2y, all ranges have identical underlying trajectory
    const rng = mulberry32(hashString(`${clean}:master_history:${interval}`));

    // 날짜 anchor를 고정한다. endDate(예: backtest의 요청 종료일)가 주어지면
    // 이를 기준으로 삼고, 없으면 SEED_END_DATE 상수를 사용한다. new Date()를
    // 쓰지 않으므로 며칠 후 재실행해도 동일한 날짜의 Seed 시계열이 재현된다.
    const anchorMs = endDate
      ? new Date(`${endDate}T00:00:00Z`).getTime()
      : new Date(`${getDefaultSeedEndDate()}T00:00:00Z`).getTime();

    let current = basePrice * 0.70;

    for (let i = maxMasterBars; i >= 0; i--) {
      const d = new Date(anchorMs - i * 24 * 60 * 60 * 1000);
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      if (isWeekend) continue;

      const randomShock = (rng() - 0.485) * 0.022;
      current = current * (1 + randomShock);
      const open = current * (1 + (rng() - 0.5) * 0.005);
      const high = Math.max(open, current) * (1 + rng() * 0.008);
      const low = Math.min(open, current) * (1 - rng() * 0.008);
      const close = current;
      const volume = Math.floor(1000000 + rng() * 5000000);

      bars.push({
        date: d.toISOString().split('T')[0],
        open: Math.round(open * 100) / 100,
        high: Math.round(high * 100) / 100,
        low: Math.round(low * 100) / 100,
        close: Math.round(close * 100) / 100,
        adjClose: Math.round(close * 100) / 100,
        volume,
      });
    }

    if (bars.length > 0) {
      // Anchor the latest bar to the seeded price while preserving OHLC
      // invariants (high >= max(open, close), low <= min(open, close)).
      const last = bars[bars.length - 1];
      last.close = basePrice;
      last.adjClose = basePrice;
      last.high = Math.max(last.high, last.open, last.close);
      last.low = Math.min(last.low, last.open, last.close);
    }

    return bars.slice(-targetBarsCount);
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
