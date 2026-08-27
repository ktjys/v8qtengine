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
  runPipelineOnSeedData,
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

// Credentials are loaded from environment variables or UI-configured at runtime.
// No hardcoded defaults — set SUPABASE_URL and SUPABASE_KEY via .env or Cloudflare runtime vars

class UniversalDatabaseClient {
  public supabase: SupabaseClient | null = null;
  public isSupabaseConnected = false;
  public missingTables = new Set<string>();
  public configSource: 'ENV' | 'UNCONFIGURED' = 'UNCONFIGURED';
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
    this.seedInMemoryState();
    this.initSupabase();
  }

  public seedInMemoryState() {
    try {
      const seed = runPipelineOnSeedData();
      for (const ev of seed.evaluations) {
        const clean = ev.ticker.toUpperCase().trim();
        this.state.evaluations.set(clean, ev);
        this.state.classifications.set(clean, ev.classification);
        this.state.assets.set(clean, {
          ticker: clean,
          name: ev.name || clean,
          asset_type: ev.classification.asset_type,
          exchange: 'US',
          currency: 'USD',
          is_active: true,
        });
      }
      for (const w of seed.watchlist) {
        this.state.watchlist.set(w.ticker.toUpperCase().trim(), w);
      }
      for (const s of INITIAL_HISTORICAL_SIGNALS) {
        this.state.signals.set(s.id, s);
      }
      for (const r of INITIAL_SCAN_RUNS) {
        this.state.scan_runs.set(r.run_id, r);
      }
    } catch (e) {
      console.warn('[SupabaseClient] Error initializing in-memory seed state:', e);
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
    // Server-side only. Credentials come exclusively from process.env at process
    // startup (set via .env / platform runtime vars). There is intentionally no
    // `import.meta.env` / VITE_-prefixed fallback here: Vite inlines VITE_* values
    // into the client bundle at build time, which would ship real DB credentials
    // to every visitor's browser. This module must never be imported from
    // browser-executed code (React components) for that same reason.
    let envUrl = '';
    let envKey = '';
    try {
      if (typeof window === 'undefined' && typeof process !== 'undefined' && process.env) {
        envUrl = process.env.SUPABASE_URL || '';
        envKey = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
      }
    } catch {}

    if (envUrl && envKey) {
      this.currentUrl = envUrl;
      this.currentKey = envKey;
      this.configSource = 'ENV';
    } else {
      this.configSource = 'UNCONFIGURED';
      console.warn('[SupabaseClient] ⚠️ No DB credentials found. Set SUPABASE_URL and SUPABASE_KEY via server-side env vars (.env / platform runtime vars). Falling back to in-memory storage.');
      return;
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

  // Server-internal only: connects using credentials pulled from a trusted
  // runtime env binding (e.g. Cloudflare Worker `env.SUPABASE_URL/KEY`, which —
  // unlike Node's process.env — is only available per-request inside the Worker
  // and is never reachable from client code). This must NEVER be wired to an
  // HTTP route or otherwise be callable with a value supplied by a request body,
  // query string, or header — that would let any caller (including a browser)
  // point the server at an arbitrary DB. There is no equivalent for changing
  // credentials at runtime; they are fixed for the lifetime of the process.
  public async connectFromTrustedEnv(
    url: string,
    key: string
  ): Promise<{ success: boolean; error?: string }> {
    if (this.isSupabaseConnected) return { success: true };

    const cleanUrl = url.trim();
    const cleanKey = key.trim();
    if (!cleanUrl || !cleanKey) {
      return { success: false, error: 'Missing SUPABASE_URL/SUPABASE_KEY env bindings.' };
    }

    try {
      this.supabase = createClient(cleanUrl, cleanKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      this.isSupabaseConnected = true;
      this.currentUrl = cleanUrl;
      this.currentKey = cleanKey;
      this.configSource = 'ENV';
      this.missingTables.clear();
      return { success: true };
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

  // Intentionally does NOT return the URL or any form of the key (masked or
  // otherwise). No caller — including the browser — needs the real connection
  // details; "connected: boolean" is sufficient for any UI to show DB health.
  // Server-side diagnostics helper only: returns the DB host with no path,
  // query, or credentials — safe to log or show in an internal ops panel.
  // Never returns the key in any form.
  getMaskedHost(): string | null {
    if (!this.currentUrl) return null;
    try {
      const u = new URL(this.currentUrl);
      return `${u.protocol}//${u.host}`;
    } catch {
      return null;
    }
  }

  getConfig() {
    return {
      connected: this.isSupabaseConnected && this.supabase !== null,
      configSource: this.configSource,
    };
  }

  getStatus() {
    return {
      connected: this.isSupabaseConnected && this.supabase !== null,
      type: 'supabase' as const,
      configSource: this.configSource,
      evaluationsCount: this.state.evaluations.size,
      signalsCount: this.state.signals.size,
      scanRunsCount: this.state.scan_runs.size,
      watchlistCount: this.state.watchlist.size,
    };
  }
}

export const dbClient = new UniversalDatabaseClient();
