import { dbClient } from '../supabaseClient';
import { RawMarketIndicators } from '../../engine/opportunityEngine';
import { assetRepository } from './assetRepository';

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
    const tradeDate = date || new Date().toISOString().split('T')[0];
    const key = `${clean}_${tradeDate}`;
    const now = new Date().toISOString();

    const record: IndicatorSnapshotRecord = {
      ticker: clean,
      trade_date: tradeDate,
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
      created_at: now,
    };

    dbClient.indicator_snapshots.set(key, record);

    if (dbClient.isTableAvailable('indicator_snapshots') && dbClient.supabase) {
      try {
        await assetRepository.upsert({
          ticker: clean,
          name: clean,
          asset_type: 'equity',
          exchange: 'US',
          currency: 'USD',
          is_active: true,
          created_at: now,
          updated_at: now,
        });

        const payload = {
          ticker: clean,
          trade_date: tradeDate,
          price: indicators.price,
          ma20: indicators.ma20,
          ma50: indicators.ma50,
          ma200: indicators.ma200,
          rsi14: indicators.rsi14,
          drawdown_52w: indicators.drawdownFromHigh,
          return_1m: indicators.return1M,
          return_3m: indicators.return3M,
          return_6m: indicators.return6M,
          relative_strength_spy: indicators.relativeStrengthVsSpy,
          created_at: now,
        };

        const { error } = await dbClient.supabase
          .from('indicator_snapshots')
          .upsert(payload, { onConflict: 'ticker,trade_date' });

        if (error) {
          dbClient.handleDbError('indicator_snapshots', 'save', error);
        }
      } catch (err) {
        dbClient.handleDbError('indicator_snapshots', 'save', err);
      }
    }
  }

  async getLatest(ticker: string): Promise<IndicatorSnapshotRecord | null> {
    const clean = ticker.toUpperCase().trim();

    if (dbClient.isTableAvailable('indicator_snapshots') && dbClient.supabase) {
      try {
        const { data, error } = await dbClient.supabase
          .from('indicator_snapshots')
          .select('*')
          .eq('ticker', clean)
          .order('trade_date', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          dbClient.handleDbError('indicator_snapshots', 'getLatest', error);
        } else if (data) {
          const rec: IndicatorSnapshotRecord = {
            ticker: data.ticker,
            trade_date: data.trade_date,
            price: Number(data.price),
            ma20: Number(data.ma20),
            ma50: Number(data.ma50),
            ma200: Number(data.ma200),
            rsi14: Number(data.rsi14),
            drawdown_from_high: Number(data.drawdown_52w || 0),
            macd_histogram_positive: true,
            return_1m: Number(data.return_1m || 0),
            return_3m: Number(data.return_3m || 0),
            return_6m: Number(data.return_6m || 0),
            relative_strength_spy: Number(data.relative_strength_spy || 0),
            created_at: data.created_at,
          };
          dbClient.indicator_snapshots.set(`${clean}_${rec.trade_date}`, rec);
          return rec;
        }
      } catch (err) {
        dbClient.handleDbError('indicator_snapshots', 'getLatest', err);
      }
    }

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

