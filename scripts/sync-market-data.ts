#!/usr/bin/env bun
/**
 * Weekly Market Data Sync to Supabase
 *
 * Fetches 2 years of daily OHLCV data for all watchlist tickers
 * and upserts to Supabase market_data_daily table.
 *
 * Run via: bun run scripts/sync-market-data.ts
 * Scheduled via: GitHub Actions (weekly)
 */

import { createClient } from '@supabase/supabase-js';
import { YahooFinanceProvider } from '../src/data/providers/yahooFinanceProvider';
import { marketDataRepository } from '../src/db/repositories/marketDataRepository';
import { assetRepository } from '../src/db/repositories/assetRepository';
import { dbClient } from '../src/db/supabaseClient';
import { watchlistRepository } from '../src/db/repositories/watchlistRepository';
import { detectMarketRegion } from '../src/utils/marketUtils';
import { OHLCVBar } from '../src/data/providers/types';

// ==========================================
// Configuration
// ==========================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/SUPABASE_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const provider = new YahooFinanceProvider();

// Default universe - major US/KR tickers for backtesting coverage
const DEFAULT_UNIVERSE = [
  // US Large Cap / ETFs
  'AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL', 'META', 'TSLA', 'AVGO',
  'JPM', 'JNJ', 'V', 'WMT', 'MA', 'UNH', 'HD', 'PG',
  'SPY', 'QQQ', 'VOO', 'VTI', 'SCHD', 'SMH', 'XLK', 'XLF',
  'AMD', 'COST', 'NFLX', 'CRM', 'ADBE', 'ORCL', 'INTC', 'CSCO',
  // KR Major
  '005930.KS', '000660.KS', '373220.KS', '207940.KS', '005380.KS',
  '069500.KS', '360750.KS', '133690.KS', '458730.KS',
  '247540.KQ', '196170.KQ', '035420.KS', '051910.KS', '035720.KS',
];

const BATCH_SIZE = 300;
const FETCH_RANGE = '2y';
const FETCH_INTERVAL = '1d';
const REQUEST_DELAY_MS = 200; // Rate limiting courtesy

// ==========================================
// Types
// ==========================================

interface SyncResult {
  ticker: string;
  status: 'success' | 'failed' | 'skipped';
  barsCount: number;
  error?: string;
}

interface MarketDataRecord {
  ticker: string;
  trade_date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  adj_close: number;
  volume: number;
  source: string;
  fetched_at: string;
}

// ==========================================
// Main Sync Logic
// ==========================================

async function getAllTickers(): Promise<string[]> {
  // 1. Get active watchlist tickers
  let watchlist: string[] = [];
  try {
    const wl = await watchlistRepository.getAll();
    watchlist = wl.filter(w => w.is_active !== false).map(w => w.ticker.toUpperCase().trim());
    console.log(`📋 Watchlist: ${watchlist.length} active tickers`);
  } catch (e) {
    console.warn('⚠️ Failed to load watchlist, using default universe');
  }

  // 2. Merge with default universe (deduplicate)
  const all = [...new Set([...watchlist, ...DEFAULT_UNIVERSE])].sort();
  console.log(`🎯 Total tickers to sync: ${all.length}`);
  return all;
}

async function fetchWithRetry(ticker: string, retries = 3): Promise<OHLCVBar[]> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const bars = await provider.getHistorical(ticker, FETCH_RANGE, FETCH_INTERVAL);
      if (bars.length >= 50) {
        return bars;
      }
      throw new Error(`Insufficient data: ${bars.length} bars`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (attempt === retries) throw err;
      console.warn(`  ⏳ ${ticker} attempt ${attempt}/${retries} failed: ${msg}, retrying...`);
      await new Promise(r => setTimeout(r, REQUEST_DELAY_MS * attempt));
    }
  }
  throw new Error('Max retries exceeded');
}

async function upsertBarsToSupabase(ticker: string, bars: OHLCVBar[]): Promise<number> {
  const cleanTicker = ticker.toUpperCase().trim();
  const now = new Date().toISOString();

  // Ensure asset exists
  await assetRepository.upsert({
    ticker: cleanTicker,
    name: cleanTicker,
    asset_type: detectMarketRegion(cleanTicker) === 'KR' ? 'equity' : 'equity',
    exchange: detectMarketRegion(cleanTicker) === 'KR' ? (cleanTicker.endsWith('.KQ') ? 'KOSDAQ' : 'KOSPI') : 'NASDAQ',
    currency: detectMarketRegion(cleanTicker) === 'KR' ? 'KRW' : 'USD',
    is_active: true,
    created_at: now,
    updated_at: now,
  });

  const records: MarketDataRecord[] = bars.map(b => ({
    ticker: cleanTicker,
    trade_date: b.date,
    open: b.open,
    high: b.high,
    low: b.low,
    close: b.close,
    adj_close: b.adjClose ?? b.close,
    volume: b.volume,
    source: 'yahoo',
    fetched_at: now,
  }));

  let totalUpserted = 0;
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const chunk = records.slice(i, i + BATCH_SIZE);
    const { error, count } = await supabase
      .from('market_data_daily')
      .upsert(chunk, { onConflict: 'ticker,trade_date', count: 'exact' });

    if (error) {
      // Check if it's a duplicate key error (harmless) or real error
      if (error.code === '23505') {
        // Duplicate key - some records already exist, that's fine
        totalUpserted += chunk.length;
        continue;
      }
      throw new Error(`Supabase upsert failed: ${error.message} (code: ${error.code})`);
    }
    totalUpserted += count ?? chunk.length;
  }

  return totalUpserted;
}

async function syncSingleTicker(ticker: string): Promise<SyncResult> {
  try {
    console.log(`  📥 Fetching ${ticker}...`);
    const bars = await fetchWithRetry(ticker);

    console.log(`  💾 Upserting ${bars.length} bars...`);
    const count = await upsertBarsToSupabase(ticker, bars);

    console.log(`  ✅ ${ticker}: ${count} bars synced`);
    return { ticker, status: 'success', barsCount: count };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  ❌ ${ticker}: ${msg}`);
    return { ticker, status: 'failed', barsCount: 0, error: msg };
  }
}

async function main() {
  console.log('🚀 Starting weekly market data sync to Supabase');
  console.log(`📅 ${new Date().toISOString()}`);
  console.log('─'.repeat(50));

  // Initialize DB client for local repositories
  await dbClient.connectFromTrustedEnv(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const tickers = await getAllTickers();
  const results: SyncResult[] = [];
  let successCount = 0;
  let failedCount = 0;
  let totalBars = 0;

  for (let i = 0; i < tickers.length; i++) {
    const ticker = tickers[i];
    console.log(`\n[${i + 1}/${tickers.length}] ${ticker}`);

    const result = await syncSingleTicker(ticker);
    results.push(result);

    if (result.status === 'success') {
      successCount++;
      totalBars += result.barsCount;
    } else {
      failedCount++;
    }

    // Rate limiting between tickers
    if (i < tickers.length - 1) {
      await new Promise(r => setTimeout(r, REQUEST_DELAY_MS));
    }
  }

  // Summary
  console.log('\n' + '═'.repeat(50));
  console.log('📊 SYNC SUMMARY');
  console.log('═'.repeat(50));
  console.log(`✅ Success: ${successCount}/${tickers.length}`);
  console.log(`❌ Failed: ${failedCount}/${tickers.length}`);
  console.log(`📈 Total bars synced: ${totalBars.toLocaleString()}`);
  console.log(`⏱️ Duration: ${((Date.now() - startTime) / 1000).toFixed(1)}s`);

  if (failedCount > 0) {
    console.log('\n❌ Failed tickers:');
    results.filter(r => r.status === 'failed').forEach(r => {
      console.log(`  - ${r.ticker}: ${r.error}`);
    });
    process.exit(1);
  }

  console.log('\n🎉 Sync completed successfully!');
}

const startTime = Date.now();
main().catch(err => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});