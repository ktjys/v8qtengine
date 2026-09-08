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
  async saveAll(items: { ticker: string; indicators: RawMarketIndicators; date: string }[]): Promise<void> {
    if (!items || items.length === 0) return;
    const now = new Date().toISOString();
    const payloads: any[] = [];

    for (const item of items) {
      const clean = item.ticker.toUpperCase().trim();
      const tradeDate = item.date || now.split('T')[0];
      const key = `${clean}_${tradeDate}`;

      const record: IndicatorSnapshotRecord = {
        ticker: clean,
        trade_date: tradeDate,
        price: item.indicators.price,
        ma20: item.indicators.ma20,
        ma50: item.indicators.ma50,
        ma200: item.indicators.ma200,
        rsi14: item.indicators.rsi14,
        drawdown_from_high: item.indicators.drawdownFromHigh,
        macd_histogram_positive: item.indicators.macdHistogramPositive,
        return_1m: item.indicators.return1M,
        return_3m: item.indicators.return3M,
        return_6m: item.indicators.return6M,
        relative_strength_spy: item.indicators.relativeStrengthVsSpy,
        created_at: now,
      };

      dbClient.indicator_snapshots.set(key, record);

      payloads.push({
        ticker: clean,
        trade_date: tradeDate,
        price: item.indicators.price,
        ma20: item.indicators.ma20,
        ma50: item.indicators.ma50,
        ma200: item.indicators.ma200,
        rsi14: item.indicators.rsi14,
        drawdown_52w: item.indicators.drawdownFromHigh,
        return_1m: item.indicators.return1M,
        return_3m: item.indicators.return3M,
        return_6m: item.indicators.return6M,
        relative_strength_spy: item.indicators.relativeStrengthVsSpy,
        created_at: now,
      });
    }

    if (dbClient.isTableAvailable('indicator_snapshots') && dbClient.supabase && payloads.length > 0) {
      try {
        const { error } = await dbClient.supabase
          .from('indicator_snapshots')
          .upsert(payloads, { onConflict: 'ticker,trade_date' });

        if (error) {
          dbClient.handleDbError('indicator_snapshots', 'saveAll', error);
        }
      } catch (err) {
        dbClient.handleDbError('indicator_snapshots', 'saveAll', err);
      }
    }
  }

  async save(ticker: string, indicators: RawMarketIndicators, date: string): Promise<void> {
    await this.saveAll([{ ticker, indicators, date }]);
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

