import { MarketDataProvider } from '../providers/marketDataProvider';
import { FundamentalData, NormalizedMarketData, OHLCVBar, QuoteData } from '../providers/types';
import { INITIAL_WATCHLIST_RAW } from './initialData';

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

  async getHistorical(ticker: string, range = '1y', interval = '1d'): Promise<OHLCVBar[]> {
    const seed = INITIAL_WATCHLIST_RAW.find((s) => s.ticker.toUpperCase() === ticker.toUpperCase());
    const basePrice = seed ? seed.price : 100;
    const bars: OHLCVBar[] = [];

    // Generate 252 synthetic daily bars with realistic drift and volatility
    const now = new Date();
    let current = basePrice * 0.85;

    for (let i = 252; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      if (isWeekend) continue;

      const randomShock = (Math.random() - 0.48) * 0.025;
      current = current * (1 + randomShock);
      const open = current * (1 + (Math.random() - 0.5) * 0.005);
      const high = Math.max(open, current) * (1 + Math.random() * 0.008);
      const low = Math.min(open, current) * (1 - Math.random() * 0.008);
      const close = current;
      const volume = Math.floor(1000000 + Math.random() * 5000000);

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
      bars[bars.length - 1].close = basePrice;
      bars[bars.length - 1].adjClose = basePrice;
    }

    return bars;
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
