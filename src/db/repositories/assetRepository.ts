import { dbClient } from '../supabaseClient';
import { WatchlistItem } from '../../types/v8';

export class AssetRepository {
  async getAll() {
    // 1. Try to fetch from Supabase if connected
    if (dbClient.isTableAvailable('assets') && dbClient.supabase) {
      try {
        const { data, error } = await dbClient.supabase
          .from('assets')
          .select('*')
          .order('ticker', { ascending: true });

        if (error) {
          console.warn('[AssetRepository] Supabase query error:', error);
          // Fall through to in-memory
        } else if (data && data.length > 0) {
          // Sync to in-memory
          data.forEach((row: any) => {
            dbClient.assets.set(row.ticker, row);
          });
          console.log(`[AssetRepository] Loaded ${data.length} assets from Supabase`);
          return data;
        }
      } catch (err) {
        console.warn('[AssetRepository] Exception fetching from Supabase:', err);
      }
    }

    // 2. Fall back to in-memory cache
    const cached = Array.from(dbClient.assets.values());
    console.log(`[AssetRepository] Returning ${cached.length} assets from in-memory cache`);
    return cached;
  }

  async upsert(asset: any) {
    const ticker = asset.ticker.toUpperCase();

    // 1. Always update in-memory
    dbClient.assets.set(ticker, {
      ticker,
      name: asset.name || ticker,
      asset_type: asset.asset_type || 'equity',
      exchange: asset.exchange || 'US',
      currency: asset.currency || 'USD',
      is_active: asset.is_active !== undefined ? asset.is_active : true,
      created_at: asset.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // 2. Try to upsert to Supabase if connected
    if (dbClient.isTableAvailable('assets') && dbClient.supabase) {
      try {
        await dbClient.supabase.from('assets').upsert(
          {
            ticker,
            name: asset.name || ticker,
            asset_type: asset.asset_type || 'equity',
            exchange: asset.exchange || 'US',
            currency: asset.currency || 'USD',
            is_active: asset.is_active !== undefined ? asset.is_active : true,
            created_at: asset.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'ticker' }
        );
      } catch (err) {
        console.warn(`[AssetRepository] Could not upsert to Supabase for ${ticker}:`, err);
      }
    }

    dbClient.saveLocalSnapshot();
  }
}

export const assetRepository = new AssetRepository();
