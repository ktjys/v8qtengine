import { dbClient } from '../supabaseClient';
import { WatchlistItem } from '../../types/v8';

export class AssetRepository {
  async getAll() {
    // 1. Always try Supabase FIRST - this is the source of truth
    if (dbClient.supabase && dbClient.isSupabaseConnected) {
      try {
        console.log('[AssetRepository] Querying Supabase assets table...');
        const { data, error } = await dbClient.supabase
          .from('assets')
          .select('*')
          .order('ticker', { ascending: true });

        if (error) {
          console.warn('[AssetRepository] Supabase error:', error);
        } else if (data && Array.isArray(data)) {
          console.log(`[AssetRepository] ✅ Loaded ${data.length} assets from Supabase`);
          // Sync all to in-memory
          data.forEach((row: any) => {
            if (row.ticker) {
              dbClient.assets.set(row.ticker.toUpperCase(), row);
            }
          });
          return data;
        }
      } catch (err) {
        console.warn('[AssetRepository] Exception querying Supabase:', err);
      }
    }

    // 2. Fall back to in-memory if Supabase fails or not connected
    const cached = Array.from(dbClient.assets.values());
    console.log(`[AssetRepository] ⚠️  Returning ${cached.length} assets from in-memory cache (Supabase unavailable)`);
    return cached;
  }

  async upsert(asset: any) {
    const ticker = asset.ticker?.toUpperCase?.() || asset.ticker;
    if (!ticker) return;

    const cleanAsset = {
      ticker,
      name: asset.name || ticker,
      asset_type: asset.asset_type || 'equity',
      exchange: asset.exchange || 'US',
      currency: asset.currency || 'USD',
      is_active: asset.is_active !== undefined ? asset.is_active : true,
      created_at: asset.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // 1. Always update in-memory first
    dbClient.assets.set(ticker, cleanAsset);
    console.log(`[AssetRepository] Updated in-memory asset: ${ticker}`);

    // 2. Try to upsert to Supabase if connected
    if (dbClient.supabase && dbClient.isSupabaseConnected) {
      try {
        const { error } = await dbClient.supabase
          .from('assets')
          .upsert([cleanAsset], { onConflict: 'ticker' });

        if (error) {
          console.warn(`[AssetRepository] Could not upsert to Supabase for ${ticker}:`, error);
        } else {
          console.log(`[AssetRepository] ✅ Upserted to Supabase: ${ticker}`);
        }
      } catch (err) {
        console.warn(`[AssetRepository] Exception upserting to Supabase for ${ticker}:`, err);
      }
    }

    dbClient.saveLocalSnapshot();
  }
}

export const assetRepository = new AssetRepository();
