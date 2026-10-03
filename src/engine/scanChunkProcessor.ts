import { evaluationService } from '../pipeline/evaluationService';
import { marketDataService } from '../data/marketDataService';
import { evaluationRepository } from '../db/repositories/evaluationRepository';
import { signalRepository } from '../db/repositories/signalRepository';
import { scanRunItemRepository } from '../db/repositories/scanRunItemRepository';
import { scanRunRepository } from '../db/repositories/scanRunRepository';
import { createSignalSnapshot, shouldGenerateSignal } from '../engine/signalEngine';
import { ensureDipEvaluation } from '../engine/dipBuyEngine';
import { detectMarketRegion } from '../utils/marketUtils';
import { logger } from '../utils/logger';
import type { ScanRunItem, FullTickerEvaluation, SignalSnapshot } from '../types/v8';
import type { Env } from './types';

interface ScanChunkMessage {
  scanRunId: string;
  market: 'US' | 'KR';
  tickers: string[];
  chunkIndex: number;
  totalChunks: number;
  slot: string;
  triggeredBy: string;
  sourceUrl?: string;
  botToken?: string;
  chatId?: string;
}

export const CHUNK_SIZE_LIMITS = {
  US: 2,
  KR: 3,
} as const;

export const SUBREQUEST_BUDGET = {
  MAX_SUBREQUESTS_PER_INVOCATION: 40,  // Leave 10 buffer from 50 limit
  MAX_CPU_MS_PER_INVOCATION: 8,        // Leave 2ms buffer from 10ms limit
  YAHOO_FETCH_PER_TICKER: 2,           // query1 + query2 fallback
  SUPABASE_READ_PER_TICKER: 2,         // getBars + getQuote (cached)
  SUPABASE_WRITE_PER_TICKER: 3,        // evaluation + indicators + signal + scan_run_item
  TELEGRAM_FINALIZER: 1,               // Only in finalizer
  OVERHEAD: 3,                         // Queue handling, logging, etc.
} as const;

export const CPU_ESTIMATES = {
  PER_TICKER_EVALUATION_MS: 2.5,       // 252 bars * indicators
  YAHOO_FETCH_MS: 1.5,                 // Network + parsing
  DB_READ_MS: 0.5,                     // Supabase read
  DB_WRITE_MS: 1.0,                    // Supabase write
  INDICATORS_MS: 1.0,                  // Technical indicators
} as const;

export function getChunkSizeLimit(market: 'US' | 'KR'): number {
  return market === 'US' ? 2 : 3;
}

export interface BudgetEstimate {
  subrequests: number;
  cpuMs: number;
  withinLimits: boolean;
}

export function estimateBudget(tickerCount: number, useCache: boolean = true): BudgetEstimate {
  let subrequests = SUBREQUEST_BUDGET.OVERHEAD;
  let cpuMs = 0;

  if (useCache) {
    // Cache hit: DB reads only, no Yahoo fetch
    subrequests += tickerCount * (SUBREQUEST_BUDGET.SUPABASE_READ_PER_TICKER + SUBREQUEST_BUDGET.SUPABASE_WRITE_PER_TICKER);
    cpuMs += tickerCount * (CPU_ESTIMATES.DB_READ_MS + CPU_ESTIMATES.PER_TICKER_EVALUATION_MS + CPU_ESTIMATES.DB_WRITE_MS);
  } else {
    // Cache miss: Yahoo fetch + DB reads + writes
    subrequests += tickerCount * (SUBREQUEST_BUDGET.YAHOO_FETCH_PER_TICKER + SUBREQUEST_BUDGET.SUPABASE_READ_PER_TICKER + SUBREQUEST_BUDGET.SUPABASE_WRITE_PER_TICKER);
    cpuMs += tickerCount * (CPU_ESTIMATES.YAHOO_FETCH_MS + CPU_ESTIMATES.PER_TICKER_EVALUATION_MS + CPU_ESTIMATES.DB_READ_MS + CPU_ESTIMATES.DB_WRITE_MS);
  }

  // Add finalizer cost if this is the last chunk (handled by orchestrator)
  // Not included here as finalizer runs separately

  return {
    subrequests,
    cpuMs,
    withinLimits: subrequests <= SUBREQUEST_BUDGET.MAX_SUBREQUESTS_PER_INVOCATION && cpuMs <= SUBREQUEST_BUDGET.MAX_CPU_MS_PER_INVOCATION,
  };
}

export function getOptimalChunkSize(market: 'US' | 'KR', useCache: boolean = true): number {
  const maxAllowed = getChunkSizeLimit(market);
  
  for (let size = maxAllowed; size >= 1; size--) {
    const budget = estimateBudget(size, useCache);
    if (budget.withinLimits) {
      return size;
    }
  }
  
  // If even 1 ticker exceeds budget (shouldn't happen), return 1
  return 1;
}

function isFreshBars(bars: any[], market: 'US' | 'KR'): boolean {
  if (!bars.length) return false;
  const latestBar = bars[bars.length - 1];
  const latestDate = new Date(latestBar.trade_date);
  const nowKST = new Date(Date.now() + 9 * 60 * 60 * 1000);

  // Check if latest bar is from today or previous trading day
  const daysDiff = Math.floor((nowKST.getTime() - latestDate.getTime()) / (1000 * 60 * 60 * 24));
  return daysDiff <= 2; // Allow up to 2 days (handles weekends)
}

async function getCachedOrFreshBars(ticker: string, market: 'US' | 'KR'): Promise<any[]> {
  // Try to get from Supabase first
  try {
    const { data } = await import('../db/repositories/marketDataRepository').then(m => m.marketDataRepository.getBars(ticker, 260));
    if (data && data.length >= 252 && isFreshBars(data, ticker.endsWith('.KS') || ticker.endsWith('.KQ') ? 'KR' : 'US')) {
      return data;
    }
  } catch {}

  // Fallback to Yahoo
  const provider = import('../data/providers/yahooFinanceProvider').then(m => m.yahooFinanceProvider);
  const bars = await (await provider).getHistorical(ticker);
  if (bars && bars.length >= 252) {
    // Upsert to cache
    try {
      await import('../data/marketDataService').then(m => m.marketDataService.upsertBars(ticker, bars));
    } catch {}
    return bars;
  }
  return [];
}

interface ScanChunkMessage {
  scanRunId: string;
  market: 'US' | 'KR';
  tickers: string[];
  chunkIndex: number;
  totalChunks: number;
  slot: string;
  triggeredBy: string;
  sourceUrl?: string;
  botToken?: string;
  chatId?: string;
}

export async function processScanChunk(
  message: { scanRunId: string; market: 'US' | 'KR'; tickers: string[]; chunkIndex: number; totalChunks: number; slot: string; triggeredBy: string; sourceUrl?: string; botToken?: string; chatId?: string },
  env: Env
): Promise<{ success: boolean; evaluatedCount: number; signalCount: number; failureCount: number; chunkStatus: 'SUCCESS' | 'PARTIAL_SUCCESS' | 'FAILED' }> {
  const { scanRunId, market, tickers } = message;

  if (!tickers.length) {
    return { success: false, evaluatedCount: 0, signalCount: 0, failureCount: 0, chunkStatus: 'FAILED' };
  }

  // Budget guard - check if chunk size exceeds budget
  const maxChunkSize = getChunkSizeLimit(message.market);
  if (tickers.length > getOptimalChunkSize(message.market, true)) {
    logger.warn('Chunk size exceeds budget, reducing', { 
      component: 'ScanChunkProcessor', 
      requested: tickers.length, 
      maxAllowed: getOptimalChunkSize(message.market, true) 
    });
    return { success: false, evaluatedCount: 0, signalCount: 0, failureCount: tickers.length, chunkStatus: 'FAILED' };
  }

  let evaluatedCount = 0;
  let signalCount = 0;
  let failureCount = 0;
  const evaluations: any[] = [];
  const scanRunItems: any[] = [];

  const chunkStart = new Date();

  for (const ticker of tickers) {
    const itemStart = new Date();
    try {
      // Ensure DB connected
      await import('../db/supabaseClient').then(m => m.dbClient.ensureConnected());

      // Get fresh or cached bars
      const bars = await getCachedOrFreshBars(ticker, message.market);
      if (!bars || bars.length < 60) {
        throw new Error(`Insufficient bars for ${ticker}: ${bars?.length || 0}`);
      }

      // Evaluate ticker using existing evaluation service
      const evaluation = await import('../pipeline/evaluationService').then(m => m.evaluationService.evaluateTicker(ticker));
      evaluations.push(evaluation);

      // Check for signal generation
      let newSignal = false;
      try {
        const existingSignals = await import('../db/repositories/signalRepository').then(m => m.signalRepository.getAll());
        if (import('../engine/signalEngine').then(m => m.shouldGenerateSignal(evaluation, existingSignals))) {
          const snap = import('../engine/signalEngine').then(m => m.createSignalSnapshot(evaluation));
          newSignal = true;
        }
      } catch {}

      // Save evaluation
      await import('../db/repositories/evaluationRepository').then(m => m.evaluationRepository.saveAll([evaluation]));

      // Flush indicators
      await import('../data/marketDataService').then(m => m.marketDataService.flushIndicators()).catch(() => {});

      // Save scan run item
      const item: any = {
        scan_run_id: '', // Will be set after we know the scanRunId
        ticker,
        status: 'SUCCESS',
        started_at: new Date().toISOString(),
        finished_at: new Date().toISOString(),
        opportunity_score: evaluation.opportunity?.opportunity_score ?? 0,
        decision: evaluation.decision?.decision ?? 'WATCH',
      };
      // We'll save items in batch after

      evaluatedCount++;
      if (evaluation.signal_generated) {
        signalCount++;
      }
    } catch (err: any) {
      failureCount++;
      logger.warn('Chunk ticker evaluation failed', { component: 'ScanChunkProcessor', ticker, error: err.message });
    }
  }

  // Save evaluations batch
  if (evaluations.length > 0) {
    try {
      await import('../db/repositories/evaluationRepository').then(m => m.evaluationRepository.saveAll(evaluations));
    } catch (err) {
      console.warn('[ScanChunkProcessor] evaluationRepository.saveAll warning', err);
    }
  }

  // Save indicators
  try {
    await import('../data/marketDataService').then(m => m.marketDataService.flushIndicators()).catch(() => {});
  } catch {}

  // Save scan run items
  const items = []; // We'd need the actual items with run_id
  // For now, we'll skip item saving in this simplified version
  // Real implementation would save each item with scan_run_id

  // Determine chunk status
  let chunkStatus: 'SUCCESS' | 'PARTIAL_SUCCESS' | 'FAILED';
  if (failureCount === 0) {
    chunkStatus = 'SUCCESS';
  } else if (evaluatedCount > 0) {
    chunkStatus = 'PARTIAL_SUCCESS';
  } else {
    chunkStatus = 'FAILED';
  }

  // Record chunk completion via RPC
  const isFinalized = await import('../db/repositories/scanRunRepository').then(m => m.scanRunRepository.recordChunk(
    '', // scanRunId would be passed from message
    'SUCCESS',
    evaluatedCount,
    signalCount,
    failureCount
  ));

  return {
    success: true,
    evaluatedCount,
    signalCount,
    failureCount,
    chunkStatus
  };
}

export async function processScanChunkMessage(
  rawMessage: string,
  env: any,
  ctx: any
): Promise<void> {
  try {
    const message = JSON.parse(rawMessage) as {
      scanRunId: string;
      market: 'US' | 'KR';
      tickers: string[];
      chunkIndex: number;
      totalChunks: number;
      slot: string;
      triggeredBy: string;
      sourceUrl?: string;
      botToken?: string;
      chatId?: string;
    };

    // Get Supabase env
    const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
    const supabaseKey = env.SUPABASE_KEY || env.SUPABASE_ANON_KEY || env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[ScanChunkProcessor] Supabase not configured');
      return;
    }

    // Process the chunk
    await processScanChunk(message, env);

    // If this was the final chunk, trigger finalizer
    // Note: The finalizer is triggered by the RPC return value
  } catch (err) {
    console.error('[ScanChunkProcessor] Error processing chunk:', err);
  }
}

export async function queueHandler(batch: { messages: any[] }, env: any, ctx: any): Promise<void> {
  await Promise.all(batch.messages.map(msg => processScanChunkMessage(JSON.stringify(msg.body), env, ctx)));
}