import { OHLCVBar, QuoteData } from '../providers/types';

export interface MarketDataValidationResult {
  isValid: boolean;
  score: number; // 0 ~ 100
  warnings: string[];
  missingBars: number;
}

export function validateMarketData(quote: QuoteData, bars: OHLCVBar[]): MarketDataValidationResult {
  const warnings: string[] = [];
  let score = 100;

  if (!quote || typeof quote.price !== 'number' || quote.price <= 0) {
    warnings.push('현재가 데이터가 없거나 0 이하입니다.');
    score -= 40;
  }

  if (bars.length < 50) {
    warnings.push(`OHLCV 데이터가 부족합니다 (${bars.length}일치, 최소 50일 권장).`);
    score -= 30;
  } else if (bars.length < 200) {
    warnings.push(`200일 장기 이평선 계산을 위한 데이터가 부분 부족합니다 (${bars.length}일치).`);
    score -= 10;
  }

  // Check for NaN or zero price bars
  const invalidBars = bars.filter((b) => isNaN(b.close) || b.close <= 0);
  if (invalidBars.length > 0) {
    warnings.push(`유효하지 않은 가격 봉이 ${invalidBars.length}건 감지되었습니다.`);
    score -= invalidBars.length * 5;
  }

  const lastBar = bars[bars.length - 1];
  if (lastBar && quote.price > 0 && Math.abs((lastBar.close - quote.price) / quote.price) > 0.35) {
    warnings.push('실시간 현재가와 최근 종가 간의 비정상적인 괴리(35% 초과)가 감지되었습니다.');
    score -= 20;
  }

  const missingBars = Math.max(0, 252 - bars.length);

  return {
    isValid: score >= 50,
    score: Math.max(10, Math.min(100, score)),
    warnings,
    missingBars,
  };
}
