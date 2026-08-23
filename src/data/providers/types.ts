export interface OHLCVBar {
  date: string; // YYYY-MM-DD or ISO
  open: number;
  high: number;
  low: number;
  close: number;
  adjClose: number;
  volume: number;
}

export interface QuoteData {
  ticker: string;
  price: number;
  change: number;
  changePercent: number;
  currency: string;
  exchange: string;
  shortName?: string;
  longName?: string;
  marketCap?: number;
  dayHigh?: number;
  dayLow?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  volume?: number;
  avgVolume?: number;
  timestamp: string;
}

export interface FundamentalData {
  ticker: string;
  asOfDate: string;
  marketCap: number;
  revenue?: number;
  revenueGrowthYoy?: number;
  eps?: number;
  earningsGrowthYoy?: number;
  operatingMargin?: number;
  freeCashFlow?: number;
  freeCashFlowMargin?: number;
  trailingPe?: number;
  forwardPe?: number;
  psRatio?: number;
  pegRatio?: number;
  beta?: number;
  dividendYield?: number;
  sector?: string;
  industry?: string;
  quoteType?: string; // ETF | EQUITY
}

export interface NormalizedMarketData {
  ticker: string;
  quote: QuoteData;
  bars: OHLCVBar[]; // sorted ascending (oldest -> newest)
  fundamentals: FundamentalData;
  benchmarkBars?: OHLCVBar[]; // SPY benchmark for relative strength & beta
  fetchedAt: string;
  source: 'yahoo' | 'seed' | 'database' | string;
}
