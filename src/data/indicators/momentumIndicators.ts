import { OHLCVBar } from '../providers/types';

export interface CalculatedMomentumIndicators {
  return1M: number; // e.g. 0.045 (4.5%)
  return3M: number; // e.g. 0.12 (12%)
  return6M: number; // e.g. 0.25 (25%)
  return12M: number; // e.g. 0.38 (38%)
  relativeStrengthVsSpy: number; // e.g. 1.25
  beta: number;
  volatility20dAnnualized: number; // e.g. 0.28 (28%)
  trendPersistence: number;
}

export function calculatePeriodReturn(bars: OHLCVBar[], tradingDays: number): number {
  if (bars.length <= tradingDays) {
    if (bars.length < 2) return 0;
    const start = bars[0].close;
    const end = bars[bars.length - 1].close;
    return start > 0 ? (end - start) / start : 0;
  }

  const start = bars[bars.length - 1 - tradingDays].close;
  const end = bars[bars.length - 1].close;
  return start > 0 ? (end - start) / start : 0;
}

export function calculateDailyReturns(bars: OHLCVBar[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    const prev = bars[i - 1].close;
    const curr = bars[i].close;
    if (prev > 0) {
      returns.push((curr - prev) / prev);
    }
  }
  return returns;
}

export function calculateAnnualizedVolatility(dailyReturns: number[], window = 20): number {
  if (dailyReturns.length < 5) return 0.2;
  const slice = dailyReturns.slice(-window);
  const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
  const variance = slice.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (slice.length - 1 || 1);
  const stdDev = Math.sqrt(variance);
  return stdDev * Math.sqrt(252); // Annualized using 252 trading days
}

export function calculateBeta(assetReturns: number[], benchmarkReturns: number[]): number {
  const n = Math.min(assetReturns.length, benchmarkReturns.length);
  if (n < 20) return 1.0;

  const a = assetReturns.slice(-n);
  const b = benchmarkReturns.slice(-n);

  const meanA = a.reduce((sum, r) => sum + r, 0) / n;
  const meanB = b.reduce((sum, r) => sum + r, 0) / n;

  let covariance = 0;
  let varianceB = 0;

  for (let i = 0; i < n; i++) {
    const diffA = a[i] - meanA;
    const diffB = b[i] - meanB;
    covariance += diffA * diffB;
    varianceB += diffB * diffB;
  }

  if (varianceB === 0) return 1.0;
  const beta = covariance / varianceB;
  return Math.round(beta * 100) / 100;
}

export function calculateMomentumIndicators(
  bars: OHLCVBar[],
  benchmarkBars?: OHLCVBar[]
): CalculatedMomentumIndicators {
  const return1M = calculatePeriodReturn(bars, 21);
  const return3M = calculatePeriodReturn(bars, 63);
  const return6M = calculatePeriodReturn(bars, 126);
  const return12M = calculatePeriodReturn(bars, 252);

  const assetDailyReturns = calculateDailyReturns(bars);
  const benchDailyReturns = benchmarkBars ? calculateDailyReturns(benchmarkBars) : [];

  let relativeStrengthVsSpy = 1.0;
  if (benchmarkBars && benchmarkBars.length > 0) {
    const spyReturn3M = calculatePeriodReturn(benchmarkBars, 63);
    const benchmarkNorm = 1 + Math.max(-0.5, spyReturn3M);
    const assetNorm = 1 + return3M;
    relativeStrengthVsSpy = Math.round((assetNorm / benchmarkNorm) * 100) / 100;
  }

  const beta = benchDailyReturns.length > 0 ? calculateBeta(assetDailyReturns, benchDailyReturns) : 1.0;
  const volatility20d = calculateAnnualizedVolatility(assetDailyReturns, 20);

  const trendPersistence = return1M > 0 && return3M > 0 ? 0.9 : return1M > 0 || return3M > 0 ? 0.7 : 0.4;

  return {
    return1M: Math.round(return1M * 10000) / 10000,
    return3M: Math.round(return3M * 10000) / 10000,
    return6M: Math.round(return6M * 10000) / 10000,
    return12M: Math.round(return12M * 10000) / 10000,
    relativeStrengthVsSpy,
    beta,
    volatility20dAnnualized: Math.round(volatility20d * 1000) / 1000,
    trendPersistence,
  };
}
