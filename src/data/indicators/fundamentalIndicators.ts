import { FundamentalData } from '../providers/types';

export interface CalculatedFundamentalIndicators {
  marketCapBillions: number;
  revenueGrowthYoy?: number;
  earningsGrowthYoy?: number;
  operatingMargin?: number;
  freeCashFlowMargin?: number;
  trailingPe?: number;
  forwardPe?: number;
  psRatio?: number;
  pegRatio?: number;
  dividendYield?: number;
  isEtf: boolean;
}

export function extractFundamentalIndicators(
  fundamentals?: Partial<FundamentalData>,
  isEtf = false
): CalculatedFundamentalIndicators {
  if (!fundamentals) {
    return {
      marketCapBillions: 10,
      isEtf,
    };
  }

  const rawCap = fundamentals.marketCap || 10_000_000_000;
  const marketCapBillions = Math.round((rawCap / 1_000_000_000) * 10) / 10;

  let pegRatio = fundamentals.pegRatio;
  if (!pegRatio && fundamentals.forwardPe && fundamentals.earningsGrowthYoy && fundamentals.earningsGrowthYoy > 0) {
    pegRatio = Math.round((fundamentals.forwardPe / (fundamentals.earningsGrowthYoy * 100)) * 100) / 100;
  }

  return {
    marketCapBillions: marketCapBillions || 10,
    revenueGrowthYoy: fundamentals.revenueGrowthYoy,
    earningsGrowthYoy: fundamentals.earningsGrowthYoy,
    operatingMargin: fundamentals.operatingMargin,
    freeCashFlowMargin: fundamentals.freeCashFlowMargin,
    trailingPe: fundamentals.trailingPe,
    forwardPe: fundamentals.forwardPe,
    psRatio: fundamentals.psRatio,
    pegRatio,
    dividendYield: fundamentals.dividendYield,
    isEtf,
  };
}
