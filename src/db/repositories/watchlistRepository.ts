import { dbClient } from '../supabaseClient';
import { WatchlistItem } from '../../types/v8';
import { assetRepository } from './assetRepository';
import { MAX_WATCHLIST_CAPACITY_PER_MARKET, getWatchlistCapacityErrorMessage } from '../../constants/limits';
import { getStockDisplayInfo, detectMarketRegion } from '../../utils/marketUtils';

export class WatchlistRepository {
  async getAll(): Promise<WatchlistItem[]> {
    if (dbClient.isTableAvailable('watchlist') && dbClient.supabase) {
      try {
        const { data, error } = await dbClient.supabase
          .from('watchlist')
          .select('*')
          .order('ticker', { ascending: true });

        if (error) {
          dbClient.handleDbError('watchlist', 'getAll', error);
        } else if (Array.isArray(data)) {
          dbClient.watchlist.clear();
          if (data.length === 0) {
            return [];
          }
          const list: WatchlistItem[] = data.map((row: any) => {
            const assetName = dbClient.assets.get(row.ticker)?.name;
            const displayInfo = getStockDisplayInfo(row.ticker, assetName || row.name);
            const resolvedName = displayInfo.primaryName || assetName || row.name || row.ticker;
            return {
              ticker: row.ticker,
              name: resolvedName,
              is_active: row.is_active ?? true,
              memo: row.memo || '감시 종목',
              created_at: row.created_at || new Date().toISOString(),
              market_region: row.market_region || detectMarketRegion(row.ticker),
            };
          });

          // Sync with in-memory map
          list.forEach((item) => dbClient.watchlist.set(item.ticker, item));
          return list;
        }
      } catch (err) {
        dbClient.handleDbError('watchlist', 'getAll', err);
      }
    }

    return Array.from(dbClient.watchlist.values());
  }

  async getActive(): Promise<WatchlistItem[]> {
    const all = await this.getAll();
    return all.filter((w) => w.is_active);
  }

  async findByTicker(ticker: string): Promise<WatchlistItem | null> {
    const clean = ticker.toUpperCase().trim();

    if (dbClient.isTableAvailable('watchlist') && dbClient.supabase) {
      try {
        const { data, error } = await dbClient.supabase
          .from('watchlist')
          .select('*')
          .eq('ticker', clean)
          .maybeSingle();

        if (error) {
          dbClient.handleDbError('watchlist', 'findByTicker', error);
        } else if (data) {
          const assetName = dbClient.assets.get(data.ticker)?.name;
          const item: WatchlistItem = {
            ticker: data.ticker,
            name: assetName || data.name || data.ticker,
            is_active: data.is_active ?? true,
            memo: data.memo || '감시 종목',
            created_at: data.created_at || new Date().toISOString(),
            market_region: data.market_region || detectMarketRegion(data.ticker),
          };
          dbClient.watchlist.set(clean, item);
          return item;
        }
      } catch (err) {
        dbClient.handleDbError('watchlist', 'findByTicker', err);
      }
    }

    return dbClient.watchlist.get(clean) || null;
  }

  async add(item: { ticker: string; name?: string; memo?: string; is_active?: boolean; market_region?: 'US' | 'KR' }): Promise<WatchlistItem> {
    const clean = item.ticker.toUpperCase().trim();
    const existing = dbClient.watchlist.get(clean);

    const marketRegion = item.market_region || detectMarketRegion(clean);

    if (!existing) {
      const currentList = await this.getAll();
      const marketCount = currentList.filter(w => (w.market_region || detectMarketRegion(w.ticker)) === marketRegion).length;
      if (marketCount >= MAX_WATCHLIST_CAPACITY_PER_MARKET) {
        throw new Error(getWatchlistCapacityErrorMessage(marketRegion));
      }
    }

    const now = new Date().toISOString();
    const isActive = item.is_active !== undefined ? item.is_active : true;

    const displayInfo = getStockDisplayInfo(clean, item.name);
    const resolvedName = item.name && item.name !== clean ? item.name : (displayInfo.primaryName || clean);

    // Ensure asset entry exists
    await assetRepository.upsert({
      ticker: clean,
      name: resolvedName,
      asset_type: 'equity',
      exchange: 'US',
      currency: 'USD',
      is_active: true,
      created_at: now,
      updated_at: now,
    });

    if (existing) {
      existing.is_active = true;
      if (item.memo) existing.memo = item.memo;
      if (item.name) existing.name = item.name;

      if (dbClient.isTableAvailable('watchlist') && dbClient.supabase) {
        const { error } = await dbClient.supabase
          .from('watchlist')
          .update({
            is_active: true,
            memo: existing.memo || null,
          })
          .eq('ticker', clean);

        dbClient.assertWriteOk('watchlist', 'update in add', error, { ticker: clean });
      }

      dbClient.watchlist.set(clean, existing);
      return existing;
    }

    const newItem: WatchlistItem = {
      ticker: clean,
      name: item.name || clean,
      is_active: true,
      memo: item.memo || '사용자 추가 감시 종목',
      created_at: now,
      market_region: marketRegion,
    };

    if (dbClient.isTableAvailable('watchlist') && dbClient.supabase) {
      const { error } = await dbClient.supabase
        .from('watchlist')
        .upsert({
          ticker: clean,
          is_active: true,
          memo: newItem.memo,
          market_region: marketRegion,
        }, { onConflict: 'ticker' });

      dbClient.assertWriteOk('watchlist', 'insert', error, { ticker: clean, market_region: marketRegion });
    }

    dbClient.watchlist.set(clean, newItem);
    return newItem;
  }

  async toggleActive(ticker: string, isActive: boolean): Promise<WatchlistItem | null> {
    return this.update(ticker, { is_active: isActive });
  }

  async update(ticker: string, updates: Partial<WatchlistItem>): Promise<WatchlistItem | null> {
    const clean = ticker.toUpperCase().trim();
    const existing = dbClient.watchlist.get(clean);
    if (!existing) return null;

    const updated: WatchlistItem = {
      ...existing,
      ...updates,
      ticker: clean,
    };

    if (dbClient.isTableAvailable('watchlist') && dbClient.supabase) {
      const { error } = await dbClient.supabase
        .from('watchlist')
        .update({
          is_active: updated.is_active,
          memo: updated.memo || null,
          market_region: updated.market_region || null,
        })
        .eq('ticker', clean);

      dbClient.assertWriteOk('watchlist', 'update', error, { ticker: clean });
    }

    dbClient.watchlist.set(clean, updated);
    return updated;
  }

  async remove(ticker: string): Promise<boolean> {
    const clean = ticker.toUpperCase().trim();

    if (dbClient.isTableAvailable('watchlist') && dbClient.supabase) {
      const { error } = await dbClient.supabase
        .from('watchlist')
        .delete()
        .eq('ticker', clean);

      dbClient.assertWriteOk('watchlist', 'delete', error, { ticker: clean });
    }

    if (dbClient.isTableAvailable('evaluations') && dbClient.supabase) {
      const { error: evalError } = await dbClient.supabase
        .from('evaluations')
        .delete()
        .eq('ticker', clean);

      if (evalError) {
        dbClient.handleDbError('evaluations', 'delete on watchlist remove', evalError);
      }
    }

    dbClient.evaluations.delete(clean);
    const res = dbClient.watchlist.delete(clean);
    return res;
  }

  async removeMany(tickers: string[]): Promise<number> {
    const cleanTickers = tickers.map((t) => t.toUpperCase().trim()).filter(Boolean);
    if (cleanTickers.length === 0) return 0;

    if (dbClient.isTableAvailable('watchlist') && dbClient.supabase) {
      const { error } = await dbClient.supabase
        .from('watchlist')
        .delete()
        .in('ticker', cleanTickers);

      dbClient.assertWriteOk('watchlist', 'removeMany', error, { tickers: cleanTickers });
    }

    if (dbClient.isTableAvailable('evaluations') && dbClient.supabase) {
      const { error: evalError } = await dbClient.supabase
        .from('evaluations')
        .delete()
        .in('ticker', cleanTickers);

      if (evalError) {
        dbClient.handleDbError('evaluations', 'delete on watchlist removeMany', evalError);
      }
    }

    let removed = 0;
    for (const t of cleanTickers) {
      dbClient.evaluations.delete(t);
      if (dbClient.watchlist.delete(t)) {
        removed++;
      }
    }
    return removed;
  }

  async removeAll(): Promise<boolean> {
    const allTickers = Array.from(dbClient.watchlist.keys());
    if (dbClient.isTableAvailable('watchlist') && dbClient.supabase) {
      const { error } = await dbClient.supabase
        .from('watchlist')
        .delete()
        .neq('ticker', '___NEVER_MATCH___');

      dbClient.assertWriteOk('watchlist', 'removeAll', error);
    }

    if (dbClient.isTableAvailable('evaluations') && dbClient.supabase && allTickers.length > 0) {
      const { error: evalError } = await dbClient.supabase
        .from('evaluations')
        .delete()
        .in('ticker', allTickers);

      if (evalError) {
        dbClient.handleDbError('evaluations', 'delete on watchlist removeAll', evalError);
      }
    }

    for (const t of allTickers) {
      dbClient.evaluations.delete(t);
    }
    dbClient.watchlist.clear();
    return true;
  }
}

export const watchlistRepository = new WatchlistRepository();
