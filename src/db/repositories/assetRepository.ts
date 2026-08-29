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
  private syncedTickers = new Set<string>();

  async findByTicker(ticker: string): Promise<AssetRecord | null> {
    const clean = ticker.toUpperCase().trim();

    if (dbClient.assets.has(clean)) {
      return dbClient.assets.get(clean)!;
    }

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
          this.syncedTickers.add(clean);
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
        const { data, error } = await dbClient.supabase
          .from('assets')
          .select('*')
          .order('ticker', { ascending: true });

        if (error) {
          console.warn('[AssetRepository] Supabase error:', error);
        } else if (Array.isArray(data) && data.length > 0) {
          dbClient.assets.clear();
          // Sync all to in-memory
          data.forEach((row: any) => {
            if (row.ticker) {
              const clean = row.ticker.toUpperCase();
              dbClient.assets.set(clean, row);
              this.syncedTickers.add(clean);
            }
          });
          return data;
        }
      } catch (err) {
        console.warn('[AssetRepository] Exception querying Supabase:', err);
      }
    }

    if (dbClient.assets.size === 0) {
      dbClient.seedInMemoryState();
    }
    return Array.from(dbClient.assets.values());
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

    // If already synced and not forcing, avoid duplicate network calls
    if (this.syncedTickers.has(ticker)) {
      return;
    }

    // 2. Try to upsert to Supabase if connected
    if (dbClient.supabase && dbClient.isSupabaseConnected) {
      try {
        const { error } = await dbClient.supabase
          .from('assets')
          .upsert([cleanAsset], { onConflict: 'ticker' });

        if (error) {
          console.warn(`[AssetRepository] Could not upsert to Supabase for ${ticker}:`, error);
        } else {
          this.syncedTickers.add(ticker);
        }
      } catch (err) {
        console.warn(`[AssetRepository] Exception upserting to Supabase for ${ticker}:`, err);
      }
    }
  }

  async upsertBatch(assets: any[]): Promise<void> {
    if (!assets || assets.length === 0) return;
    const cleanList: AssetRecord[] = [];
    const now = new Date().toISOString();

    for (const a of assets) {
      const ticker = a.ticker?.toUpperCase?.() || a.ticker;
      if (!ticker) continue;
      const rec: AssetRecord = {
        ticker,
        name: a.name || ticker,
        asset_type: a.asset_type || 'equity',
        exchange: a.exchange || 'US',
        currency: a.currency || 'USD',
        is_active: a.is_active !== undefined ? a.is_active : true,
        created_at: a.created_at || now,
        updated_at: now,
      };
      dbClient.assets.set(ticker, rec);
      if (!this.syncedTickers.has(ticker)) {
        cleanList.push(rec);
      }
    }

    if (cleanList.length > 0 && dbClient.supabase && dbClient.isSupabaseConnected) {
      try {
        const { error } = await dbClient.supabase
          .from('assets')
          .upsert(cleanList, { onConflict: 'ticker' });

        if (!error) {
          cleanList.forEach((a) => this.syncedTickers.add(a.ticker));
        }
      } catch (err) {
        console.warn('[AssetRepository] Batch upsert error:', err);
      }
    }
  }
}

export const assetRepository = new AssetRepository();

