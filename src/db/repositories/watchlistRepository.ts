import { dbClient } from '../supabaseClient';
import { WatchlistItem } from '../../types/v8';
import { assetRepository } from './assetRepository';

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
          const list: WatchlistItem[] = data.map((row: any) => {
            const assetName = dbClient.assets.get(row.ticker)?.name;
            return {
              ticker: row.ticker,
              name: assetName || row.name || row.ticker,
              is_active: row.is_active ?? true,
              memo: row.memo || '감시 종목',
              created_at: row.created_at || new Date().toISOString(),
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

  async add(item: { ticker: string; name?: string; memo?: string; is_active?: boolean }): Promise<WatchlistItem> {
    const clean = item.ticker.toUpperCase().trim();
    const existing = dbClient.watchlist.get(clean);
    const now = new Date().toISOString();
    const isActive = item.is_active !== undefined ? item.is_active : true;

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

      if (dbClient.isTableAvailable('watchlist') && dbClient.supabase) {
        try {
          const { error } = await dbClient.supabase
            .from('watchlist')
            .update({
              is_active: true,
              memo: existing.memo || null,
            })
            .eq('ticker', clean);

          if (error) {
            dbClient.handleDbError('watchlist', 'update in add', error);
          }
        } catch (err) {
          dbClient.handleDbError('watchlist', 'update in add', err);
        }
      }

      dbClient.watchlist.set(clean, existing);
      dbClient.saveLocalSnapshot();
      return existing;
    }

    const newItem: WatchlistItem = {
      ticker: clean,
      name: item.name || clean,
      is_active: true,
      memo: item.memo || '사용자 추가 감시 종목',
      created_at: now,
    };

    if (dbClient.isTableAvailable('watchlist') && dbClient.supabase) {
      try {
        const { error } = await dbClient.supabase
          .from('watchlist')
          .upsert({
            ticker: clean,
            is_active: true,
            memo: newItem.memo,
          }, { onConflict: 'ticker' });

        if (error) {
          dbClient.handleDbError('watchlist', 'insert', error);
        }
      } catch (err) {
        dbClient.handleDbError('watchlist', 'insert', err);
      }
    }

    dbClient.watchlist.set(clean, newItem);
    dbClient.saveLocalSnapshot();
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
      try {
        const { error } = await dbClient.supabase
          .from('watchlist')
          .update({
            is_active: updated.is_active,
            memo: updated.memo || null,
          })
          .eq('ticker', clean);

        if (error) {
          dbClient.handleDbError('watchlist', 'update', error);
        }
      } catch (err) {
        dbClient.handleDbError('watchlist', 'update', err);
      }
    }

    dbClient.watchlist.set(clean, updated);
    dbClient.saveLocalSnapshot();
    return updated;
  }

  async remove(ticker: string): Promise<boolean> {
    const clean = ticker.toUpperCase().trim();

    if (dbClient.isTableAvailable('watchlist') && dbClient.supabase) {
      try {
        const { error } = await dbClient.supabase
          .from('watchlist')
          .delete()
          .eq('ticker', clean);

        if (error) {
          dbClient.handleDbError('watchlist', 'delete', error);
        }
      } catch (err) {
        dbClient.handleDbError('watchlist', 'delete', err);
      }
    }

    if (dbClient.isTableAvailable('evaluations') && dbClient.supabase) {
      try {
        await dbClient.supabase.from('evaluations').delete().eq('ticker', clean);
      } catch (err) {
        // Silently ignore evaluation deletion error
      }
    }

    dbClient.evaluations.delete(clean);
    const res = dbClient.watchlist.delete(clean);
    dbClient.saveLocalSnapshot();
    return res;
  }
}

export const watchlistRepository = new WatchlistRepository();
