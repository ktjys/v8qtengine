import { dbClient } from '../supabaseClient';
import { AssetType } from '../../types/v8';

export interface AssetRecord {
  ticker: string;
  name: string;
  asset_type?: AssetType | string;
  exchange?: string;
  sector?: string;
  industry?: string;
  currency?: string;
  is_active?: boolean;
  metadata_json?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

export class AssetRepository {
  async findByTicker(ticker: string): Promise<AssetRecord | null> {
    const clean = ticker.toUpperCase().trim();

    // 1. Always try Supabase FIRST if connected
    if (dbClient.supabase && dbClient.isSupabaseConnected) {
      try {
        const { data, error } = await dbClient.supabase
          .from('assets')
          .select('*')
          .eq('ticker', clean)
          .maybeSingle();

        if (error) {
          console.warn(`[AssetRepository] findByTicker error for ${clean}:`, error);
        } else if (data) {
          dbClient.assets.set(clean, data);
          return data;
        }
      } catch (err) {
        console.warn(`[AssetRepository] findByTicker exception for ${clean}:`, err);
      }
    }

    return null;
  }

  async getAll(): Promise<AssetRecord[]> {
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
        } else if (Array.isArray(data)) {
          console.log(`[AssetRepository] ✅ Loaded ${data.length} assets from Supabase`);
          dbClient.assets.clear();
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

    return [];
  }

  async upsert(asset: any) {
    const ticker = asset.ticker?.toUpperCase?.() || asset.ticker;
    if (!ticker) return;

    const cleanAsset: AssetRecord = {
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
  }
}

export const assetRepository = new AssetRepository();

