import { OHLCVBar } from '../providers/types';

export interface CalculatedTechnicalIndicators {
  price: number;
  ma20: number;
  ma50: number;
  ma200: number;
  rsi14: number;
  drawdownFromHigh: number; // e.g. -0.052 (-5.2%)
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  macd: number;
  macdSignal: number;
  macdHistogram: number;
  macdHistogramPositive: boolean;
  ma20Above50: boolean;
  ma50Above200: boolean;
  priceAboveMa20: boolean;
  priceBelowMa200: boolean;
}

export function calculateSMA(closes: number[], period: number): number {
  if (closes.length < period) {
    if (closes.length === 0) return 0;
    const sum = closes.reduce((a, b) => a + b, 0);
    return sum / closes.length;
  }
  const slice = closes.slice(-period);
  const sum = slice.reduce((a, b) => a + b, 0);
  return sum / period;
}

export function calculateEMA(values: number[], period: number): number[] {
  if (values.length === 0) return [];
  const k = 2 / (period + 1);
  const emaArr: number[] = [values[0]];

  for (let i = 1; i < values.length; i++) {
    const nextEMA = values[i] * k + emaArr[i - 1] * (1 - k);
    emaArr.push(nextEMA);
  }
  return emaArr;
}

export function calculateRSI(closes: number[], period = 14): number {
  if (closes.length <= period) {
    return 50.0;
  }

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) {
      avgGain = (avgGain * (period - 1) + change) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) + Math.abs(change)) / period;
    }
  }

  if (avgLoss === 0) return 100.0;
  const rs = avgGain / avgLoss;
  const rsi = 100 - 100 / (1 + rs);
  return Math.round(rsi * 10) / 10;
}

export function calculateMACD(
  closes: number[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9
): { macd: number; signal: number; histogram: number } {
  if (closes.length < slowPeriod) {
    return { macd: 0, signal: 0, histogram: 0 };
  }

  const fastEMA = calculateEMA(closes, fastPeriod);
  const slowEMA = calculateEMA(closes, slowPeriod);

  const macdLine: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    macdLine.push(fastEMA[i] - slowEMA[i]);
  }

  const signalLine = calculateEMA(macdLine, signalPeriod);

  const lastMacd = macdLine[macdLine.length - 1];
  const lastSignal = signalLine[signalLine.length - 1];
  const histogram = lastMacd - lastSignal;

  return {
    macd: Math.round(lastMacd * 100) / 100,
    signal: Math.round(lastSignal * 100) / 100,
    histogram: Math.round(histogram * 100) / 100,
  };
}

export function calculateTechnicalIndicators(bars: OHLCVBar[]): CalculatedTechnicalIndicators {
  if (bars.length === 0) {
    return {
      price: 100,
      ma20: 100,
      ma50: 100,
      ma200: 100,
      rsi14: 50,
      drawdownFromHigh: 0,
      fiftyTwoWeekHigh: 100,
      fiftyTwoWeekLow: 100,
      macd: 0,
      macdSignal: 0,
      macdHistogram: 0,
      macdHistogramPositive: true,
      ma20Above50: true,
      ma50Above200: true,
      priceAboveMa20: true,
      priceBelowMa200: false,
    };
  }

  const closes = bars.map((b) => b.close);
  const highs = bars.map((b) => b.high);
  const lows = bars.map((b) => b.low);
  const currentPrice = closes[closes.length - 1];

  const ma20 = calculateSMA(closes, 20);
  const ma50 = calculateSMA(closes, 50);
  const ma200 = calculateSMA(closes, 200);
  const rsi14 = calculateRSI(closes, 14);
  const macdResult = calculateMACD(closes);

  // 52-week (approx 252 bars) high/low
  const bars52w = bars.slice(-252);
  const fiftyTwoWeekHigh = Math.max(...bars52w.map((b) => b.high));
  const fiftyTwoWeekLow = Math.min(...bars52w.map((b) => b.low));

  const drawdownFromHigh = fiftyTwoWeekHigh > 0 ? (currentPrice - fiftyTwoWeekHigh) / fiftyTwoWeekHigh : 0;

  return {
    price: Math.round(currentPrice * 100) / 100,
    ma20: Math.round(ma20 * 100) / 100,
    ma50: Math.round(ma50 * 100) / 100,
    ma200: Math.round(ma200 * 100) / 100,
    rsi14,
    drawdownFromHigh: Math.round(drawdownFromHigh * 10000) / 10000,
    fiftyTwoWeekHigh: Math.round(fiftyTwoWeekHigh * 100) / 100,
    fiftyTwoWeekLow: Math.round(fiftyTwoWeekLow * 100) / 100,
    macd: macdResult.macd,
    macdSignal: macdResult.signal,
    macdHistogram: macdResult.histogram,
    macdHistogramPositive: macdResult.histogram >= 0,
    ma20Above50: ma20 >= ma50,
    ma50Above200: ma50 >= ma200,
    priceAboveMa20: currentPrice >= ma20,
    priceBelowMa200: currentPrice < ma200,
  };
}
