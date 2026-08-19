import { dbClient } from '../supabaseClient';
import { WatchlistItem } from '../../types/v8';
import { assetRepository } from './assetRepository';

export class WatchlistRepository {
  async getAll(): Promise<WatchlistItem[]> {
    if (dbClient.supabase) {
      try {
        const { data, error } = await dbClient.supabase
          .from('watchlist')
          .select('*, assets(name)')
          .order('created_at', { ascending: true });

        if (!error && data && data.length > 0) {
          const list: WatchlistItem[] = data.map((row: any) => ({
            ticker: row.ticker,
            name: row.assets?.name || row.ticker,
            is_active: row.is_active ?? true,
            memo: row.memo || '감시 종목',
            created_at: row.created_at,
          }));

          // Sync with in-memory map
          list.forEach((item) => dbClient.watchlist.set(item.ticker, item));
          return list;
        }
      } catch (err) {
        console.warn('[WatchlistRepository] Supabase getAll error, fallback to local cache:', err);
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

    if (dbClient.supabase) {
      try {
        const { data, error } = await dbClient.supabase
          .from('watchlist')
          .select('*, assets(name)')
          .eq('ticker', clean)
          .maybeSingle();

        if (!error && data) {
          const item: WatchlistItem = {
            ticker: data.ticker,
            name: data.assets?.name || data.ticker,
            is_active: data.is_active ?? true,
            memo: data.memo || '감시 종목',
            created_at: data.created_at,
          };
          dbClient.watchlist.set(clean, item);
          return item;
        }
      } catch (err) {
        console.warn(`[WatchlistRepository] Supabase findByTicker error for ${clean}:`, err);
      }
    }

    return dbClient.watchlist.get(clean) || null;
  }

  async add(item: { ticker: string; name?: string; memo?: string }): Promise<WatchlistItem> {
    const clean = item.ticker.toUpperCase().trim();
    const existing = dbClient.watchlist.get(clean);
    const now = new Date().toISOString();

    // Ensure asset entry exists
    await assetRepository.upsert({
      ticker: clean,
      name: item.name || clean,
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

      if (dbClient.supabase) {
        try {
          await dbClient.supabase
            .from('watchlist')
            .update({
              is_active: true,
              memo: existing.memo || null,
              updated_at: now,
            })
            .eq('ticker', clean);
        } catch (err) {
          console.warn(`[WatchlistRepository] Supabase update in add() failed for ${clean}:`, err);
        }
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
    };

    if (dbClient.supabase) {
      try {
        await dbClient.supabase
          .from('watchlist')
          .insert({
            ticker: clean,
            is_active: true,
            memo: newItem.memo,
            created_at: now,
            updated_at: now,
          });
      } catch (err) {
        console.warn(`[WatchlistRepository] Supabase insert failed for ${clean}:`, err);
      }
    }

    dbClient.watchlist.set(clean, newItem);
    return newItem;
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

    if (dbClient.supabase) {
      try {
        await dbClient.supabase
          .from('watchlist')
          .update({
            is_active: updated.is_active,
            memo: updated.memo || null,
            updated_at: new Date().toISOString(),
          })
          .eq('ticker', clean);
      } catch (err) {
        console.warn(`[WatchlistRepository] Supabase update failed for ${clean}:`, err);
      }
    }

    dbClient.watchlist.set(clean, updated);
    return updated;
  }

  async remove(ticker: string): Promise<boolean> {
    const clean = ticker.toUpperCase().trim();

    if (dbClient.supabase) {
      try {
        await dbClient.supabase
          .from('watchlist')
          .delete()
          .eq('ticker', clean);
      } catch (err) {
        console.warn(`[WatchlistRepository] Supabase delete failed for ${clean}:`, err);
      }
    }

    return dbClient.watchlist.delete(clean);
  }
}

export const watchlistRepository = new WatchlistRepository();
