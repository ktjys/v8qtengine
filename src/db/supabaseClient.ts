import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  AssetClassification,
  FullTickerEvaluation,
  ScanRunLog,
  SignalSnapshot,
  WatchlistItem,
} from '../types/v8';
import {
  INITIAL_HISTORICAL_SIGNALS,
  INITIAL_SCAN_RUNS,
  INITIAL_WATCHLIST_RAW,
} from '../data/seed/initialData';

export interface DatabaseState {
  assets: Map<string, any>;
  watchlist: Map<string, WatchlistItem>;
  classifications: Map<string, AssetClassification>;
  market_data_daily: Map<string, any>;
  fundamentals: Map<string, any>;
  indicator_snapshots: Map<string, any>;
  evaluations: Map<string, FullTickerEvaluation>;
  signals: Map<string, SignalSnapshot>;
  scan_runs: Map<string, ScanRunLog>;
}

export interface TableStatusInfo {
  name: string;
  exists: boolean;
  count: number;
  error?: string;
}

const CONFIG_STORAGE_KEY = 'quant_db_config';
const SNAPSHOT_STORAGE_KEY = 'quant_data_persistence';

class UniversalDatabaseClient {
  public supabase: SupabaseClient | null = null;
  public isSupabaseConnected = false;
  public missingTables = new Set<string>();
  public configSource: 'UI_CONFIGURED' | 'ENV_FALLBACK' | 'LOCAL' = 'LOCAL';
  private currentUrl = '';
  private currentKey = '';
  private state: DatabaseState = {
    assets: new Map(),
    watchlist: new Map(),
    classifications: new Map(),
    market_data_daily: new Map(),
    fundamentals: new Map(),
    indicator_snapshots: new Map(),
    evaluations: new Map(),
    signals: new Map(),
    scan_runs: new Map(),
  };

  constructor() {
    this.initSupabase();
    this.loadInitialData();
  }

  private readSavedConfig(): { url?: string; key?: string; is_disconnected?: boolean } | null {
    try {
      if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
        const raw = window.localStorage.getItem(CONFIG_STORAGE_KEY);
        if (raw) return JSON.parse(raw);
      }
    } catch (e) {
      console.warn('[SupabaseClient] Could not read saved DB config:', e);
    }
    return null;
  }

  private saveDbConfig(cfg: { url?: string; key?: string; is_disconnected?: boolean }) {
    try {
      if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
        window.localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(cfg));
      }
    } catch (e) {
      console.warn('[SupabaseClient] Could not write DB config:', e);
    }
  }

  private loadInitialData() {
    let isCleared = false;
    try {
      if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
        isCleared = window.localStorage.getItem('quant_db_cleared_v8') === 'true';
      }
    } catch {}

    if (isCleared) {
      // User explicitly cleared DB: keep completely empty
      return;
    }

    // 1. Then overlay persisted local snapshot if available
    const hasSnapshot = this.loadLocalSnapshot();
    if (!hasSnapshot && !this.isSupabaseConnected && !this.currentUrl) {
      // 2. Only seed on first virgin startup
      this.seedInitial();
    }
  }

  public saveLocalSnapshot() {
    try {
      const payload = {
        timestamp: new Date().toISOString(),
        supabase_url: this.currentUrl || undefined,
        supabase_key: this.currentKey || undefined,
        config_source: this.configSource,
        watchlist: Array.from(this.state.watchlist.entries()),
        assets: Array.from(this.state.assets.entries()),
        signals: Array.from(this.state.signals.entries()),
        scan_runs: Array.from(this.state.scan_runs.entries()),
        classifications: Array.from(this.state.classifications.entries()),
        evaluations: Array.from(this.state.evaluations.entries()),
      };
      if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
        window.localStorage.setItem(SNAPSHOT_STORAGE_KEY, JSON.stringify(payload));
      }
      if (this.currentUrl) {
        this.saveDbConfig({ url: this.currentUrl, key: this.currentKey, is_disconnected: false });
      }
    } catch (err) {
      // Silently handle
    }
  }

  public loadLocalSnapshot(): boolean {
    try {
      if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
        const raw = window.localStorage.getItem(SNAPSHOT_STORAGE_KEY);
        if (raw) {
          const data = JSON.parse(raw);

          if (data.watchlist && Array.isArray(data.watchlist) && data.watchlist.length > 0) {
            this.state.watchlist.clear();
            for (const [k, v] of data.watchlist) {
              this.state.watchlist.set(k, v);
            }
          }
          if (data.assets && Array.isArray(data.assets) && data.assets.length > 0) {
            for (const [k, v] of data.assets) {
              this.state.assets.set(k, v);
            }
          }
          if (data.signals && Array.isArray(data.signals) && data.signals.length > 0) {
            for (const [k, v] of data.signals) {
              this.state.signals.set(k, v);
            }
          }
          if (data.scan_runs && Array.isArray(data.scan_runs) && data.scan_runs.length > 0) {
            for (const [k, v] of data.scan_runs) {
              this.state.scan_runs.set(k, v);
            }
          }
          if (data.classifications && Array.isArray(data.classifications) && data.classifications.length > 0) {
            for (const [k, v] of data.classifications) {
              this.state.classifications.set(k, v);
            }
          }
          if (data.evaluations && Array.isArray(data.evaluations) && data.evaluations.length > 0) {
            this.state.evaluations.clear();
            for (const [k, v] of data.evaluations) {
              this.state.evaluations.set(k, v);
            }
          }
          console.log(`[SupabaseClient] Successfully restored local snapshot with ${this.state.watchlist.size} watchlist tickers, ${this.state.evaluations.size} evaluations`);
          return true;
        }
      }
    } catch (err) {
      console.warn('[SupabaseClient] Could not read local snapshot', err);
    }
    return false;
  }

  public isTableAvailable(tableName: string): boolean {
    if (!this.supabase || !this.isSupabaseConnected) return false;
    if (this.missingTables.has(tableName)) return false;
    return true;
  }

  public markTableMissing(tableName: string) {
    if (!this.missingTables.has(tableName)) {
      this.missingTables.add(tableName);
      console.warn(`[SupabaseClient] '${tableName}' 테이블이 Supabase에 없거나 준비되지 않아 인메모리 저장소로 자동 전환합니다.`);
    }
  }

  public handleDbError(tableName: string, operation: string, error: any) {
    if (!error) return;
    const msg = error.message || String(error);
    if (
      msg.includes('schema cache') ||
      msg.includes('does not exist') ||
      msg.includes('42P01') ||
      msg.includes('PGRST205') ||
      msg.includes('not found')
    ) {
      this.markTableMissing(tableName);
    } else {
      console.warn(`[SupabaseClient] Table: ${tableName}, Op: ${operation} - ${msg}`);
    }
  }

  private initSupabase() {
    // 1. Check UI-configured saved credentials FIRST (Highest Priority)
    const saved = this.readSavedConfig();

    if (saved) {
      if (saved.is_disconnected) {
        console.log('[SupabaseClient] Saved config indicates explicit disconnection (Local Mode active)');
        this.currentUrl = saved.url || '';
        this.currentKey = saved.key || '';
        this.configSource = 'LOCAL';
        this.supabase = null;
        this.isSupabaseConnected = false;
        return;
      }

      if (saved.url && saved.key) {
        this.currentUrl = saved.url;
        this.currentKey = saved.key;
        this.configSource = 'UI_CONFIGURED';
        try {
          this.supabase = createClient(saved.url, saved.key, {
            auth: {
              persistSession: false,
              autoRefreshToken: false,
            },
          });
          this.isSupabaseConnected = true;
          if (typeof process !== 'undefined' && process.env) {
            process.env.SUPABASE_URL = saved.url;
            process.env.SUPABASE_KEY = saved.key;
          }
          console.log(`[SupabaseClient] Initialized with UI-configured settings (PRIORITIZED OVER ENV): ${saved.url}`);
          return;
        } catch (err) {
          console.warn('[SupabaseClient] Failed to initialize UI-configured Supabase client:', err);
          this.supabase = null;
          this.isSupabaseConnected = false;
          return;
        }
      } else if (saved.url) {
        this.currentUrl = saved.url;
      }
    }

    // 2. Fallback to Environment Variables (Only if no UI configuration exists)
    let envUrl = '';
    let envKey = '';
    try {
      if (typeof process !== 'undefined' && process.env) {
        envUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
        envKey =
          process.env.SUPABASE_KEY ||
          process.env.SUPABASE_SERVICE_ROLE_KEY ||
          process.env.SUPABASE_ANON_KEY ||
          process.env.VITE_SUPABASE_ANON_KEY ||
          '';
      }
    } catch {}

    if (!envUrl && typeof import.meta !== 'undefined' && (import.meta as any).env) {
      envUrl = (import.meta as any).env.VITE_SUPABASE_URL || '';
      envKey = envKey || (import.meta as any).env.VITE_SUPABASE_ANON_KEY || '';
    }

    if (envUrl && envKey) {
      this.currentUrl = this.currentUrl || envUrl;
      this.currentKey = envKey;
      this.configSource = 'ENV_FALLBACK';
      try {
        this.supabase = createClient(envUrl, envKey, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        });
        this.isSupabaseConnected = true;
        console.log('[SupabaseClient] Initialized with ENV fallback Supabase credentials:', envUrl);
      } catch (err) {
        console.warn('[SupabaseClient] Failed to initialize ENV Supabase client:', err);
        this.supabase = null;
        this.isSupabaseConnected = false;
      }
    } else {
      console.log('[SupabaseClient] No Supabase credentials found, using in-memory persistent fallback');
      this.configSource = 'LOCAL';
    }
  }

  public async configureSupabase(
    url: string,
    key: string
  ): Promise<{ success: boolean; error?: string; tables?: Record<string, TableStatusInfo> }> {
    const cleanUrl = url.trim();
    const cleanKey = key.trim();

    if (!cleanUrl || !cleanKey) {
      return { success: false, error: 'Supabase URL과 API Key를 모두 입력해야 합니다.' };
    }

    try {
      const client = createClient(cleanUrl, cleanKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });

      // Test connection by checking assets table
      const { error } = await client.from('assets').select('ticker', { count: 'exact', head: true });

      // If we got a network / auth error (e.g., invalid key or bad URL)
      if (error && error.code !== '42P01' && !error.message.includes('relation "assets" does not exist')) {
        // Table not existing is ok (code 42P01 or relation doesn't exist), but invalid key/host is not
        if (error.message.includes('JWT') || error.message.includes('Invalid API key') || error.message.includes('fetch failed')) {
          return { success: false, error: `Supabase 연결 실패: ${error.message}` };
        }
      }

      this.supabase = client;
      this.isSupabaseConnected = true;
      this.currentUrl = cleanUrl;
      this.currentKey = cleanKey;
      this.configSource = 'UI_CONFIGURED';
      if (typeof process !== 'undefined' && process.env) {
        process.env.SUPABASE_URL = cleanUrl;
        process.env.SUPABASE_KEY = cleanKey;
      }
      this.missingTables.clear();

      this.saveDbConfig({
        url: cleanUrl,
        key: cleanKey,
        is_disconnected: false,
      });
      this.saveLocalSnapshot();

      const tables = await this.checkTableStatus();

      return { success: true, tables };
    } catch (err: any) {
      return { success: false, error: err.message || 'Supabase 클라이언트 생성 중 오류가 발생했습니다.' };
    }
  }

  public disconnectSupabase() {
    this.supabase = null;
    this.isSupabaseConnected = false;
    this.missingTables.clear();
    this.configSource = 'LOCAL';
    const oldUrl = this.currentUrl;
    this.currentKey = '';
    if (typeof process !== 'undefined' && process.env) {
      delete process.env.SUPABASE_KEY;
    }

    this.saveDbConfig({
      url: oldUrl,
      is_disconnected: true,
    });
    this.saveLocalSnapshot();
  }

  public async checkTableStatus(): Promise<Record<string, TableStatusInfo>> {
    const tableNames = [
      'assets',
      'watchlist',
      'market_data_daily',
      'fundamentals',
      'indicator_snapshots',
      'evaluations',
      'signals',
      'signal_outcomes',
      'scan_runs',
      'scan_run_items',
    ];

    const result: Record<string, TableStatusInfo> = {};

    if (!this.supabase) {
      this.missingTables.clear();
      tableNames.forEach((t) => {
        result[t] = { name: t, exists: false, count: 0, error: 'DB 미연결 (로컬 메모리 모드)' };
      });
      return result;
    }

    for (const tbl of tableNames) {
      try {
        const { count, error } = await this.supabase
          .from(tbl)
          .select('*', { count: 'exact', head: true });

        if (error) {
          this.missingTables.add(tbl);
          result[tbl] = {
            name: tbl,
            exists: false,
            count: 0,
            error: error.message,
          };
        } else {
          this.missingTables.delete(tbl);
          result[tbl] = {
            name: tbl,
            exists: true,
            count: count || 0,
          };
        }
      } catch (e: any) {
        this.missingTables.add(tbl);
        result[tbl] = {
          name: tbl,
          exists: false,
          count: 0,
          error: e.message || '조회 실패',
        };
      }
    }

    return result;
  }

  public async seedToActiveDb(): Promise<{ success: boolean; seededCount: number; error?: string }> {
    let count = 0;
    try {
      if (this.supabase) {
        // 1. Seed Assets
        const assetRows = INITIAL_WATCHLIST_RAW.map((item) => ({
          ticker: item.ticker,
          name: item.name,
          asset_type: item.metadata.quoteType === 'ETF' ? 'etf' : 'equity',
          exchange: 'NASDAQ',
          sector: item.metadata.sector || 'Technology',
          industry: item.metadata.industry || 'Semiconductors',
          currency: 'USD',
          is_active: true,
          metadata_json: item.metadata,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }));

        await this.supabase.from('assets').upsert(assetRows, { onConflict: 'ticker' });

        // 2. Seed Watchlist
        const watchlistRows = INITIAL_WATCHLIST_RAW.map((item) => ({
          ticker: item.ticker,
          is_active: true,
          memo: item.memo,
          priority: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }));

        await this.supabase.from('watchlist').upsert(watchlistRows, { onConflict: 'ticker' });

        // 3. Seed Signals
        const signalRows = INITIAL_HISTORICAL_SIGNALS.map((sig) => ({
          id: sig.id.startsWith('sig-') ? undefined : sig.id,
          ticker: sig.ticker,
          signal_date: sig.signal_date,
          strategy_type: sig.strategy_type,
          opportunity_score: sig.opportunity_score,
          risk_score: sig.risk_score,
          risk_level: sig.risk_level,
          decision: sig.decision,
          confidence: sig.signal_confidence,
          entry_price: sig.signal_price,
          technical_score: sig.technical_score,
          momentum_score: sig.momentum_score,
          fundamental_score: sig.fundamental_score,
          valuation_score: sig.valuation_score,
          status: 'ACTIVE',
          created_at: new Date().toISOString(),
        }));

        await this.supabase.from('signals').upsert(signalRows);
        count = assetRows.length;
      } else {
        this.seedInitial();
        count = this.state.watchlist.size;
      }

      if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
        window.localStorage.removeItem('quant_db_cleared_v8');
      }

      return { success: true, seededCount: count };
    } catch (err: any) {
      console.error('[SupabaseClient] seedToActiveDb error:', err);
      return { success: false, seededCount: 0, error: err.message };
    }
  }

  public async clearAllData(): Promise<{ success: boolean; clearedTables: string[]; error?: string }> {
    const clearedTables: string[] = [];
    try {
      // 1. Clear Supabase tables if connected
      if (this.supabase && this.isSupabaseConnected) {
        const tablesToDelete = [
          'signal_outcomes',
          'scan_run_items',
          'scan_runs',
          'signals',
          'evaluations',
          'indicator_snapshots',
          'market_data_daily',
          'fundamentals',
          'watchlist',
          'assets',
        ];

        for (const table of tablesToDelete) {
          try {
            if (table === 'assets' || table === 'watchlist') {
              const { error } = await this.supabase.from(table).delete().neq('ticker', '___DUMMY_NEVER_MATCH___');
              if (!error) clearedTables.push(table);
            } else if (table === 'market_data_daily' || table === 'fundamentals' || table === 'indicator_snapshots') {
              const { error } = await this.supabase.from(table).delete().neq('ticker', '___DUMMY_NEVER_MATCH___');
              if (!error) clearedTables.push(table);
            } else {
              const { error } = await this.supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
              if (!error) clearedTables.push(table);
            }
          } catch (tblErr) {
            console.warn(`[SupabaseClient] Failed to truncate table ${table}:`, tblErr);
          }
        }
      }

      // 2. Clear all in-memory states
      this.state.assets.clear();
      this.state.watchlist.clear();
      this.state.classifications.clear();
      this.state.market_data_daily.clear();
      this.state.fundamentals.clear();
      this.state.indicator_snapshots.clear();
      this.state.evaluations.clear();
      this.state.signals.clear();
      this.state.scan_runs.clear();

      // 3. Clear localStorage snapshots & record explicit cleared flag
      if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
        window.localStorage.removeItem(SNAPSHOT_STORAGE_KEY);
        window.localStorage.removeItem('quant_watchlist_cache_v8');
        window.localStorage.removeItem('quant_evaluations_cache_v8');
        window.localStorage.setItem('quant_db_cleared_v8', 'true');
      }

      return { success: true, clearedTables };
    } catch (err: any) {
      console.error('[SupabaseClient] clearAllData error:', err);
      return { success: false, clearedTables, error: err.message };
    }
  }

  public seedInitial() {
    // Seed initial assets & watchlist
    for (const item of INITIAL_WATCHLIST_RAW) {
      this.watchlist.set(item.ticker, {
        ticker: item.ticker,
        name: item.name,
        is_active: true,
        memo: item.memo,
        created_at: '2026-08-01T00:00:00.000Z',
      });

      this.assets.set(item.ticker, {
        ticker: item.ticker,
        name: item.name,
        asset_type: item.metadata.quoteType === 'ETF' ? 'etf' : 'equity',
        exchange: 'NASDAQ',
        sector: item.metadata.sector,
        industry: item.metadata.industry,
        currency: 'USD',
        is_active: true,
        metadata_json: item.metadata,
        created_at: '2026-08-01T00:00:00.000Z',
        updated_at: new Date().toISOString(),
      });
    }

    // Seed initial historical signals
    for (const sig of INITIAL_HISTORICAL_SIGNALS) {
      this.signals.set(sig.id, sig);
    }

    // Seed initial scan runs
    for (const run of INITIAL_SCAN_RUNS) {
      this.scan_runs.set(run.run_id, run);
    }
  }

  get assets() {
    return this.state.assets;
  }
  get watchlist() {
    return this.state.watchlist;
  }
  get classifications() {
    return this.state.classifications;
  }
  get market_data_daily() {
    return this.state.market_data_daily;
  }
  get fundamentals() {
    return this.state.fundamentals;
  }
  get indicator_snapshots() {
    return this.state.indicator_snapshots;
  }
  get evaluations() {
    return this.state.evaluations;
  }
  get signals() {
    return this.state.signals;
  }
  get scan_runs() {
    return this.state.scan_runs;
  }

  getConfig() {
    return {
      connected: this.isSupabaseConnected && this.supabase !== null,
      url: this.currentUrl || '',
      maskedKey: this.currentKey
        ? this.currentKey.slice(0, 8) + '...' + this.currentKey.slice(-4)
        : '',
      hasKey: !!this.currentKey,
      configSource: this.configSource,
      isUiOverridden: this.configSource === 'UI_CONFIGURED',
    };
  }

  getStatus() {
    return {
      connected: this.isSupabaseConnected && this.supabase !== null,
      type:
        this.isSupabaseConnected && this.supabase !== null
          ? ('supabase' as const)
          : ('local_persistent' as const),
      url: this.currentUrl || '',
      configSource: this.configSource,
      isUiOverridden: this.configSource === 'UI_CONFIGURED',
      evaluationsCount: this.state.evaluations.size,
      signalsCount: this.state.signals.size,
      scanRunsCount: this.state.scan_runs.size,
      watchlistCount: this.state.watchlist.size,
    };
  }
}

export const dbClient = new UniversalDatabaseClient();
