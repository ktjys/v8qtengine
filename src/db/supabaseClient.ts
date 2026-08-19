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

class UniversalDatabaseClient {
  public supabase: SupabaseClient | null = null;
  public isSupabaseConnected = false;
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
    this.seedInitial();
  }

  private initSupabase() {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const key =
      process.env.SUPABASE_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY;

    if (url && key) {
      try {
        this.supabase = createClient(url, key, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        });
        this.isSupabaseConnected = true;
        console.log('[SupabaseClient] Initialized Supabase client successfully with URL:', url);
      } catch (err) {
        console.warn('[SupabaseClient] Failed to initialize Supabase client:', err);
        this.supabase = null;
        this.isSupabaseConnected = false;
      }
    } else {
      console.log('[SupabaseClient] No Supabase credentials found in env, using in-memory persistent fallback');
    }
  }

  private seedInitial() {
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

  getStatus() {
    return {
      connected: this.isSupabaseConnected && this.supabase !== null,
      type: this.isSupabaseConnected && this.supabase !== null ? ('supabase' as const) : ('local_persistent' as const),
      evaluationsCount: this.state.evaluations.size,
      signalsCount: this.state.signals.size,
      scanRunsCount: this.state.scan_runs.size,
      watchlistCount: this.state.watchlist.size,
    };
  }
}

export const dbClient = new UniversalDatabaseClient();
