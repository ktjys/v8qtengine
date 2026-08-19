import { FundamentalData } from '../providers/types';

export interface FundamentalValidationResult {
  isValid: boolean;
  score: number;
  warnings: string[];
}

export function validateFundamentals(
  fundamentals: FundamentalData,
  isEtf: boolean
): FundamentalValidationResult {
  const warnings: string[] = [];
  let score = 100;

  if (isEtf) {
    return {
      isValid: true,
      score: 100,
      warnings: [],
    };
  }

  if (!fundamentals.marketCap || fundamentals.marketCap <= 0) {
    warnings.push('시가총액 데이터가 누락되었습니다.');
    score -= 20;
  }

  if (fundamentals.revenueGrowthYoy === undefined || fundamentals.revenueGrowthYoy === null) {
    warnings.push('YoY 매출 성장률 데이터가 없습니다.');
    score -= 15;
  }

  if (fundamentals.earningsGrowthYoy === undefined || fundamentals.earningsGrowthYoy === null) {
    warnings.push('YoY EPS 성장률 데이터가 없습니다.');
    score -= 15;
  }

  if (fundamentals.operatingMargin === undefined || fundamentals.operatingMargin === null) {
    warnings.push('영업이익률 데이터가 없습니다.');
    score -= 10;
  }

  if (!fundamentals.trailingPe && !fundamentals.forwardPe) {
    warnings.push('PER 밸류에이션 지표가 누락되었습니다.');
    score -= 10;
  }

  return {
    isValid: score >= 40,
    score: Math.max(10, Math.min(100, score)),
    warnings,
  };
}
