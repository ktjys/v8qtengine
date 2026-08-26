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

export const DEFAULT_SUPABASE_URL = 'https://xuzctskacealvvwlmica.supabase.co';
export const DEFAULT_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1emN0c2thY2VhbHZ2d2xtaWNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2NTAwNjUsImV4cCI6MjA3NTIyNjA2NX0.0O7d4e5kU4Y8KqC2wG9_9U3z_uH0vN4c1jB2vF5xR-M';

const CONFIG_STORAGE_KEY = 'quant_db_config';

class UniversalDatabaseClient {
  public supabase: SupabaseClient | null = null;
  public isSupabaseConnected = false;
  public missingTables = new Set<string>();
  public configSource: 'UI_CONFIGURED' | 'ENV_FALLBACK' | 'DEFAULT_DIRECT' = 'DEFAULT_DIRECT';
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
  }

  private readSavedConfig(): { url?: string; key?: string } | null {
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

  private saveDbConfig(cfg: { url?: string; key?: string }) {
    try {
      if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
        window.localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(cfg));
      }
    } catch (e) {
      console.warn('[SupabaseClient] Could not write DB config:', e);
    }
  }

  public isTableAvailable(tableName: string): boolean {
    if (!this.supabase || !this.isSupabaseConnected) return false;
    if (this.missingTables.has(tableName)) return false;
    return true;
  }

  public markTableMissing(tableName: string) {
    if (!this.missingTables.has(tableName)) {
      this.missingTables.add(tableName);
      console.warn(`[SupabaseClient] '${tableName}' 테이블이 Supabase에 없거나 준비되지 않았습니다.`);
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
    // 1. Check UI-configured saved credentials
    const saved = this.readSavedConfig();
    if (saved && saved.url && saved.key) {
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
        console.log(`[SupabaseClient] Initialized with UI-configured Supabase: ${saved.url}`);
        return;
      } catch (err) {
        console.warn('[SupabaseClient] Failed to initialize UI-configured Supabase:', err);
      }
    }

    // 2. Check Environment Variables
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
      this.currentUrl = envUrl;
      this.currentKey = envKey;
      this.configSource = 'ENV_FALLBACK';
    } else {
      // 3. Guaranteed Production Supabase (Never local-mode)
      this.currentUrl = DEFAULT_SUPABASE_URL;
      this.currentKey = DEFAULT_SUPABASE_KEY;
      this.configSource = 'DEFAULT_DIRECT';
    }

    try {
      this.supabase = createClient(this.currentUrl, this.currentKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
      this.isSupabaseConnected = true;
      if (typeof process !== 'undefined' && process.env) {
        process.env.SUPABASE_URL = this.currentUrl;
        process.env.SUPABASE_KEY = this.currentKey;
      }
      console.log(`[SupabaseClient] ✅ Supabase Client connected to ${this.currentUrl} (${this.configSource})`);
    } catch (err) {
      console.error('[SupabaseClient] CRITICAL: Failed to create Supabase client:', err);
      this.supabase = null;
      this.isSupabaseConnected = false;
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

      if (error && error.code !== '42P01' && !error.message.includes('relation "assets" does not exist')) {
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
      });

      const tables = await this.checkTableStatus();
      return { success: true, tables };
    } catch (err: any) {
      return { success: false, error: err.message || 'Supabase 클라이언트 생성 중 오류가 발생했습니다.' };
    }
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
        result[t] = { name: t, exists: false, count: 0, error: 'Supabase 클라이언트 미초기화' };
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
      if (!this.supabase) {
        return { success: false, seededCount: 0, error: 'Supabase DB가 연결되어 있지 않습니다.' };
      }

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

      await this.supabase.from('signals').upsert(signalRows, { onConflict: 'id' });

      // 4. Seed Scan Runs
      const scanRows = INITIAL_SCAN_RUNS.map((run) => ({
        id: run.run_id.startsWith('run-') ? undefined : run.run_id,
        status: run.status,
        started_at: run.started_at,
        finished_at: run.finished_at,
        watchlist_count: run.watchlist_count,
        evaluated_count: run.evaluated_count,
        signal_count: run.signal_count,
        failure_count: run.failure_count || 0,
        error_summary: run.error_summary || null,
      }));

      await this.supabase.from('scan_runs').upsert(scanRows, { onConflict: 'id' });

      count = INITIAL_WATCHLIST_RAW.length;
      return { success: true, seededCount: count };
    } catch (err: any) {
      console.error('[SupabaseClient] seedToActiveDb error:', err);
      return { success: false, seededCount: count, error: err.message };
    }
  }

  public async clearAllData(): Promise<{ success: boolean; clearedTables: string[]; error?: string }> {
    const clearedTables: string[] = [];
    try {
      const tablesToDelete = [
        'signal_outcomes',
        'scan_run_items',
        'scan_runs',
        'signals',
        'evaluations',
        'indicator_snapshots',
        'fundamentals',
        'market_data_daily',
        'watchlist',
        'assets',
      ];

      if (this.supabase && this.isSupabaseConnected) {
        for (const tbl of tablesToDelete) {
          try {
            if (tbl === 'assets' || tbl === 'watchlist') {
              const { error } = await this.supabase
                .from(tbl)
                .delete()
                .neq('ticker', '___IMPOSSIBLE_VALUE___');
              if (!error) clearedTables.push(tbl);
            } else {
              const { error } = await this.supabase
                .from(tbl)
                .delete()
                .neq('id', '00000000-0000-0000-0000-000000000000');
              if (!error) {
                clearedTables.push(tbl);
              } else {
                const { error: err2 } = await this.supabase
                  .from(tbl)
                  .delete()
                  .neq('ticker', '___IMPOSSIBLE_VALUE___');
                if (!err2) clearedTables.push(tbl);
              }
            }
          } catch (delErr) {
            console.warn(`[SupabaseClient] Error deleting from ${tbl}:`, delErr);
          }
        }
      }

      this.state.assets.clear();
      this.state.watchlist.clear();
      this.state.classifications.clear();
      this.state.market_data_daily.clear();
      this.state.fundamentals.clear();
      this.state.indicator_snapshots.clear();
      this.state.evaluations.clear();
      this.state.signals.clear();
      this.state.scan_runs.clear();

      return { success: true, clearedTables };
    } catch (err: any) {
      console.error('[SupabaseClient] clearAllData error:', err);
      return { success: false, clearedTables, error: err.message };
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
      url: this.currentUrl || DEFAULT_SUPABASE_URL,
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
      type: 'supabase' as const,
      url: this.currentUrl || DEFAULT_SUPABASE_URL,
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
