import { dbClient } from '../supabaseClient';
import { RawMarketIndicators } from '../../engine/opportunityEngine';

export interface IndicatorSnapshotRecord {
  ticker: string;
  trade_date: string;
  price: number;
  ma20: number;
  ma50: number;
  ma200: number;
  rsi14: number;
  drawdown_from_high: number;
  macd_histogram_positive: boolean;
  return_1m: number;
  return_3m: number;
  return_6m: number;
  relative_strength_spy: number;
  created_at: string;
}

export class IndicatorRepository {
  async save(ticker: string, indicators: RawMarketIndicators, date: string): Promise<void> {
    const clean = ticker.toUpperCase().trim();
    const key = `${clean}_${date}`;
    dbClient.indicator_snapshots.set(key, {
      ticker: clean,
      trade_date: date,
      price: indicators.price,
      ma20: indicators.ma20,
      ma50: indicators.ma50,
      ma200: indicators.ma200,
      rsi14: indicators.rsi14,
      drawdown_from_high: indicators.drawdownFromHigh,
      macd_histogram_positive: indicators.macdHistogramPositive,
      return_1m: indicators.return1M,
      return_3m: indicators.return3M,
      return_6m: indicators.return6M,
      relative_strength_spy: indicators.relativeStrengthVsSpy,
      created_at: new Date().toISOString(),
    });
  }

  async getLatest(ticker: string): Promise<IndicatorSnapshotRecord | null> {
    const clean = ticker.toUpperCase().trim();
    const matching: IndicatorSnapshotRecord[] = [];
    for (const [k, v] of dbClient.indicator_snapshots.entries()) {
      if (k.startsWith(`${clean}_`)) {
        matching.push(v);
      }
    }
    if (matching.length === 0) return null;
    matching.sort((a, b) => b.trade_date.localeCompare(a.trade_date));
    return matching[0];
  }
}

export const indicatorRepository = new IndicatorRepository();
