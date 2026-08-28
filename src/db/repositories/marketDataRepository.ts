import { dbClient } from '../supabaseClient';
import { OHLCVBar } from '../../data/providers/types';
import { assetRepository } from './assetRepository';

export interface MarketDataDailyRecord {
  ticker: string;
  trade_date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  adj_close: number;
  volume: number;
  source: string;
  fetched_at: string;
}

export class MarketDataRepository {
  async saveBars(ticker: string, bars: OHLCVBar[], source = 'yahoo'): Promise<number> {
    const clean = ticker.toUpperCase().trim();
    const now = new Date().toISOString();
    let count = 0;

    if (bars.length === 0) return 0;

    // Ensure parent asset exists
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

    const records: MarketDataDailyRecord[] = [];

    for (const b of bars) {
      const key = `${clean}_${b.date}`;
      const rec: MarketDataDailyRecord = {
        ticker: clean,
        trade_date: b.date,
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
        adj_close: b.adjClose,
        volume: b.volume,
        source,
        fetched_at: now,
      };
      dbClient.market_data_daily.set(key, rec);
      records.push(rec);
      count++;
    }

    if (dbClient.isTableAvailable('market_data_daily') && dbClient.supabase && records.length > 0) {
      try {
        // Upsert in batches of 100 to Supabase
        const batchSize = 100;
        for (let i = 0; i < records.length; i += batchSize) {
          const chunk = records.slice(i, i + batchSize).map((r) => ({
            ticker: r.ticker,
            trade_date: r.trade_date,
            open: r.open,
            high: r.high,
            low: r.low,
            close: r.close,
            adj_close: r.adj_close,
            volume: r.volume,
            source: r.source,
            fetched_at: r.fetched_at,
          }));

          const { error } = await dbClient.supabase
            .from('market_data_daily')
            .upsert(chunk, { onConflict: 'ticker,trade_date' });

          if (error) {
            dbClient.handleDbError('market_data_daily', 'upsert', error);
          }
        }
      } catch (err) {
        dbClient.handleDbError('market_data_daily', 'upsert', err);
      }
    }

    return count;
  }

  async getBars(ticker: string, limit = 252): Promise<OHLCVBar[]> {
    const clean = ticker.toUpperCase().trim();

    if (dbClient.isTableAvailable('market_data_daily') && dbClient.supabase) {
      try {
        const { data, error } = await dbClient.supabase
          .from('market_data_daily')
          .select('*')
          .eq('ticker', clean)
          .order('trade_date', { ascending: false })
          .limit(limit);

        if (error) {
          dbClient.handleDbError('market_data_daily', 'getBars', error);
        } else if (data && data.length > 0) {
          const sorted = data.reverse();
          const bars: OHLCVBar[] = sorted.map((r: any) => ({
            date: r.trade_date,
            open: Number(r.open),
            high: Number(r.high),
            low: Number(r.low),
            close: Number(r.close),
            adjClose: Number(r.adj_close),
            volume: Number(r.volume),
            source: r.source ?? undefined,
          }));

          // Sync to cache, preserving the DB record's original source
          for (const b of bars) {
            dbClient.market_data_daily.set(`${clean}_${b.date}`, {
              ticker: clean,
              trade_date: b.date,
              open: b.open,
              high: b.high,
              low: b.low,
              close: b.close,
              adj_close: b.adjClose,
              volume: b.volume,
              source: b.source ?? 'supabase',
              fetched_at: new Date().toISOString(),
            });
          }

          return bars;
        }
      } catch (err) {
        dbClient.handleDbError('market_data_daily', 'getBars', err);
      }
    }

    // Local fallback
    const records: MarketDataDailyRecord[] = [];
    for (const [k, v] of dbClient.market_data_daily.entries()) {
      if (k.startsWith(`${clean}_`)) {
        records.push(v);
      }
    }

    records.sort((a, b) => a.trade_date.localeCompare(b.trade_date));
    const sliced = records.slice(-limit);

    return sliced.map((r) => ({
      date: r.trade_date,
      open: r.open,
      high: r.high,
      low: r.low,
      close: r.close,
      adjClose: r.adj_close,
      volume: r.volume,
      source: r.source ?? undefined,
    }));
  }
}

export const marketDataRepository = new MarketDataRepository();
