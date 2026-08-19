import { FundamentalData, NormalizedMarketData, OHLCVBar, QuoteData } from './types';

export interface MarketDataProvider {
  readonly name: string;
  getQuote(ticker: string): Promise<QuoteData>;
  getHistorical(ticker: string, range?: string, interval?: string): Promise<OHLCVBar[]>;
  getFundamentals(ticker: string): Promise<FundamentalData>;
  getBenchmark(range?: string): Promise<OHLCVBar[]>;
  getNormalizedMarketData(ticker: string, benchmarkBars?: OHLCVBar[]): Promise<NormalizedMarketData>;
}
