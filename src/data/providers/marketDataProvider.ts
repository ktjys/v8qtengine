import { FundamentalData, NormalizedMarketData, OHLCVBar, QuoteData } from './types';

export interface MarketDataProvider {
  readonly name: string;
  /** 마지막 조회에서 seed 폴백으로 대체되었는지 여부 (선택). 기본 false 취급. */
  getHadFallback?(): boolean;
  /** 폴백 플래그를 초기화 (선택). 종목별 정직한 출처 추적을 위해 사용. */
  resetFallbackFlag?(): void;
  getQuote(ticker: string): Promise<QuoteData>;
  getHistorical(ticker: string, range?: string, interval?: string): Promise<OHLCVBar[]>;
  getFundamentals(ticker: string): Promise<FundamentalData>;
  getBenchmark(range?: string): Promise<OHLCVBar[]>;
  getNormalizedMarketData(ticker: string, benchmarkBars?: OHLCVBar[]): Promise<NormalizedMarketData>;
}
