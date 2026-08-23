import { dbClient } from '../supabaseClient';
import { AssetType } from '../../types/v8';

export interface AssetRecord {
  ticker: string;
  name: string;
  asset_type: AssetType;
  exchange: string;
  sector?: string;
  industry?: string;
  currency: string;
  is_active: boolean;
  metadata_json?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export class AssetRepository {
  async findByTicker(ticker: string): Promise<AssetRecord | null> {
    const clean = ticker.toUpperCase().trim();

    if (dbClient.isTableAvailable('assets') && dbClient.supabase) {
      try {
        const { data, error } = await dbClient.supabase
          .from('assets')
          .select('*')
          .eq('ticker', clean)
          .maybeSingle();

        if (error) {
          dbClient.handleDbError('assets', 'findByTicker', error);
        } else if (data) {
          const record: AssetRecord = {
            ticker: data.ticker,
            name: data.name,
            asset_type: data.asset_type as AssetType,
            exchange: data.exchange || 'US',
            sector: data.sector,
            industry: data.industry,
            currency: data.currency || 'USD',
            is_active: data.is_active ?? true,
            metadata_json: data.metadata_json,
            created_at: data.created_at,
            updated_at: data.updated_at,
          };
          dbClient.assets.set(clean, record);
          return record;
        }
      } catch (err) {
        dbClient.handleDbError('assets', 'findByTicker', err);
      }
    }

    return dbClient.assets.get(clean) || null;
  }

  async getAll(): Promise<AssetRecord[]> {
    if (dbClient.isTableAvailable('assets') && dbClient.supabase) {
      try {
        const { data, error } = await dbClient.supabase
          .from('assets')
          .select('*')
          .order('ticker', { ascending: true });

        if (error) {
          dbClient.handleDbError('assets', 'getAll', error);
        } else if (data && data.length > 0) {
          const records: AssetRecord[] = data.map((item) => ({
            ticker: item.ticker,
            name: item.name,
            asset_type: item.asset_type as AssetType,
            exchange: item.exchange || 'US',
            sector: item.sector,
            industry: item.industry,
            currency: item.currency || 'USD',
            is_active: item.is_active ?? true,
            metadata_json: item.metadata_json,
            created_at: item.created_at,
            updated_at: item.updated_at,
          }));

          // Sync to cache
          records.forEach((r) => dbClient.assets.set(r.ticker, r));
          return records;
        }
      } catch (err) {
        dbClient.handleDbError('assets', 'getAll', err);
      }
    }

    return Array.from(dbClient.assets.values());
  }

  async upsert(asset: AssetRecord): Promise<AssetRecord> {
    const clean = asset.ticker.toUpperCase().trim();
    const now = new Date().toISOString();
    const existing = dbClient.assets.get(clean);

    const record: AssetRecord = {
      ...existing,
      ...asset,
      ticker: clean,
      updated_at: now,
      created_at: existing?.created_at || now,
    };

    if (dbClient.isTableAvailable('assets') && dbClient.supabase) {
      try {
        const payload = {
          ticker: record.ticker,
          name: record.name,
          asset_type: record.asset_type,
          exchange: record.exchange || 'US',
          sector: record.sector || null,
          industry: record.industry || null,
          currency: record.currency || 'USD',
          is_active: record.is_active,
          metadata_json: record.metadata_json || {},
          updated_at: record.updated_at,
        };

        const { error } = await dbClient.supabase
          .from('assets')
          .upsert(payload, { onConflict: 'ticker' });

        if (error) {
          dbClient.handleDbError('assets', 'upsert', error);
        }
      } catch (err) {
        dbClient.handleDbError('assets', 'upsert', err);
      }
    }

    dbClient.assets.set(clean, record);
    return record;
  }
}

export const assetRepository = new AssetRepository();
