import { evaluationService } from '../pipeline/evaluationService';
import { marketDataService } from '../data/marketDataService';
import { evaluationRepository } from '../db/repositories/evaluationRepository';
import { signalRepository } from '../db/repositories/signalRepository';
import { scanRunItemRepository } from '../db/repositories/scanRunItemRepository';
import { scanRunRepository } from '../db/repositories/scanRunRepository';
import { createSignalSnapshot, shouldGenerateSignal } from '../engine/signalEngine';
import { logger } from '../utils/logger';
import { dbClient } from '../db/supabaseClient';
import type { ScanRunItem } from '../types/v8';
import type { ChunkStatus, Env, ScanChunkMessage, ScanChunkResult, ScanMarket } from './types';

export const CHUNK_SIZE_LIMITS = {
  US: 5,
  KR: 5,
} as const;

export const SUBREQUEST_BUDGET = {
  MAX_SUBREQUESTS_PER_INVOCATION: 40,
  MAX_CPU_MS_PER_INVOCATION: 8,
  YAHOO_FETCH_PER_TICKER: 2,
  SUPABASE_READ_PER_TICKER: 2,
  SUPABASE_WRITE_PER_TICKER: 3,
  TELEGRAM_FINALIZER: 1,
  OVERHEAD: 3,
} as const;

export const CPU_ESTIMATES = {
  // Cache hit: ~1.6ms (live quote + DB read/write + evaluation engine)
  // Cache miss: ~4.5ms (includes Yahoo fetch + indicator calculation)
  PER_TICKER_EVALUATION_MS: 1.6,
  YAHOO_FETCH_MS: 1.5,
  DB_READ_MS: 0.5,
  DB_WRITE_MS: 1.0,
  INDICATORS_MS: 1.0,
} as const;

export function getChunkSizeLimit(market: ScanMarket): number {
  return market === 'US' ? CHUNK_SIZE_LIMITS.US : CHUNK_SIZE_LIMITS.KR;
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
    subrequests += tickerCount * (SUBREQUEST_BUDGET.SUPABASE_READ_PER_TICKER + SUBREQUEST_BUDGET.SUPABASE_WRITE_PER_TICKER);
    cpuMs += tickerCount * (CPU_ESTIMATES.DB_READ_MS + CPU_ESTIMATES.PER_TICKER_EVALUATION_MS + CPU_ESTIMATES.DB_WRITE_MS);
  } else {
    subrequests += tickerCount * (SUBREQUEST_BUDGET.YAHOO_FETCH_PER_TICKER + SUBREQUEST_BUDGET.SUPABASE_READ_PER_TICKER + SUBREQUEST_BUDGET.SUPABASE_WRITE_PER_TICKER);
    cpuMs += tickerCount * (CPU_ESTIMATES.YAHOO_FETCH_MS + CPU_ESTIMATES.PER_TICKER_EVALUATION_MS + CPU_ESTIMATES.DB_READ_MS + CPU_ESTIMATES.DB_WRITE_MS);
  }

  return {
    subrequests,
    cpuMs,
    withinLimits:
      subrequests <= SUBREQUEST_BUDGET.MAX_SUBREQUESTS_PER_INVOCATION &&
      cpuMs <= SUBREQUEST_BUDGET.MAX_CPU_MS_PER_INVOCATION,
  };
}

export function getOptimalChunkSize(market: ScanMarket, useCache: boolean = true): number {
  const maxAllowed = getChunkSizeLimit(market);

  for (let size = maxAllowed; size >= 1; size--) {
    if (estimateBudget(size, useCache).withinLimits) {
      return size;
    }
  }

  return 1;
}

function resolveChunkStatus(evaluatedCount: number, failureCount: number): ChunkStatus {
  if (failureCount === 0 && evaluatedCount > 0) return 'SUCCESS';
  if (evaluatedCount > 0) return 'PARTIAL_SUCCESS';
  return 'FAILED';
}

export async function processScanChunk(
  message: ScanChunkMessage,
  env: Env
): Promise<ScanChunkResult> {
  const { scanRunId, market, tickers } = message;

  const empty: ScanChunkResult = {
    success: false,
    evaluatedCount: 0,
    signalCount: 0,
    failureCount: 0,
    chunkStatus: 'FAILED',
    finalized: false,
  };

  if (!scanRunId) {
    logger.error('Chunk message missing scanRunId', { component: 'ScanChunkProcessor' });
    return empty;
  }

  if (!Array.isArray(tickers) || tickers.length === 0) {
    logger.error('Chunk message has no tickers', { component: 'ScanChunkProcessor', scanRunId });
    return empty;
  }

  const maxChunkSize = getOptimalChunkSize(market, true);
  if (tickers.length > maxChunkSize) {
    logger.error('Chunk exceeds subrequest budget', {
      component: 'ScanChunkProcessor',
      scanRunId,
      received: tickers.length,
      maxAllowed: maxChunkSize,
    });
    const finalized = await scanRunRepository.recordChunk(scanRunId, 'FAILED', 0, 0, tickers.length);
    return { ...empty, failureCount: tickers.length, finalized };
  }

  dbClient.ensureConnected();

  let evaluatedCount = 0;
  let signalCount = 0;
  let failureCount = 0;
  const evaluations: Awaited<ReturnType<typeof evaluationService.evaluateTicker>>[] = [];
  const items: ScanRunItem[] = [];

  // Process tickers in small batches to overlap I/O wait times
  const PARALLEL_BATCH_SIZE = 2;
  for (let i = 0; i < tickers.length; i += PARALLEL_BATCH_SIZE) {
    const batch = tickers.slice(i, i + PARALLEL_BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async (ticker) => {
        const startedAt = new Date().toISOString();
        try {
          const evaluation = await evaluationService.evaluateTicker(ticker);
          const recent = await signalRepository.findByTickerRecent(ticker, 3);
          const isSignal = shouldGenerateSignal(evaluation, recent ? [recent] : []);

          return {
            success: true,
            evaluation,
            recent,
            isSignal,
            startedAt,
            ticker,
          };
        } catch (err) {
          return {
            success: false,
            error: err instanceof Error ? err.message : String(err),
            ticker,
          };
        }
      })
    );

    for (const result of batchResults) {
      if (result.success) {
        const { evaluation, recent, isSignal, startedAt, ticker } = result;
        evaluations.push(evaluation);

        if (isSignal) {
          await signalRepository.save(createSignalSnapshot(evaluation));
          signalCount++;
        }

        evaluatedCount++;

        items.push({
          scan_run_id: scanRunId,
          ticker,
          status: 'SUCCESS',
          started_at: startedAt,
          finished_at: new Date().toISOString(),
          opportunity_score: evaluation.opportunity?.opportunity_score ?? 0,
          decision: evaluation.decision?.decision ?? 'WATCH',
        });
      } else {
        failureCount++;
        const errorMessage = result.error;
        logger.warn('Chunk ticker evaluation failed', {
          component: 'ScanChunkProcessor',
          scanRunId: message.scanRunId,
          ticker: result.ticker,
          error: errorMessage,
        });
        items.push({
          scan_run_id: scanRunId,
          ticker: result.ticker,
          status: 'FAILED',
          error_code: 'EVALUATION_FAILED',
          error_message: errorMessage.slice(0, 500),
          started_at: result.startedAt,
          finished_at: new Date().toISOString(),
        });
      }
    }
  }

  if (evaluations.length > 0) {
    await evaluationRepository.saveAll(evaluations);
  }

  try {
    await marketDataService.flushIndicators();
  } catch (err) {
    logger.warn('Indicator flush failed', { component: 'ScanChunkProcessor', error: String(err) });
  }

  await scanRunItemRepository.saveItems(items);

  const chunkStatus = resolveChunkStatus(evaluatedCount, failureCount);
  const finalized = await scanRunRepository.recordChunk(
    scanRunId,
    chunkStatus,
    evaluatedCount,
    signalCount,
    failureCount
  );

  return {
    success: chunkStatus !== 'FAILED',
    evaluatedCount,
    signalCount,
    failureCount,
    chunkStatus,
    finalized,
  };
}

export function parseChunkMessage(body: unknown): ScanChunkMessage | null {
  let candidate: unknown = body;

  if (typeof candidate === 'string') {
    try {
      candidate = JSON.parse(candidate);
    } catch {
      return null;
    }
  }

  if (typeof candidate !== 'object' || candidate === null) {
    return null;
  }

  const raw = candidate as Partial<ScanChunkMessage>;
  if (typeof raw.scanRunId !== 'string' || !raw.scanRunId) return null;
  if (raw.market !== 'US' && raw.market !== 'KR') return null;
  if (!Array.isArray(raw.tickers)) return null;

  return {
    scanRunId: raw.scanRunId,
    market: raw.market,
    tickers: raw.tickers.filter((t): t is string => typeof t === 'string'),
    chunkIndex: typeof raw.chunkIndex === 'number' ? raw.chunkIndex : 0,
    totalChunks: typeof raw.totalChunks === 'number' ? raw.totalChunks : 1,
    slot: typeof raw.slot === 'string' ? raw.slot : '',
    triggeredBy: typeof raw.triggeredBy === 'string' ? raw.triggeredBy : 'unknown',
    sourceUrl: typeof raw.sourceUrl === 'string' ? raw.sourceUrl : undefined,
  };
}

export async function processScanChunkMessage(
  rawBody: unknown,
  env: Env,
  ctx: { waitUntil?: (promise: Promise<unknown>) => void } | undefined
): Promise<void> {
  const message = parseChunkMessage(rawBody);
  if (!message) {
    logger.error('Unable to parse chunk message', { component: 'ScanChunkProcessor' });
    return;
  }

  if (!env.SUPABASE_URL && !env.VITE_SUPABASE_URL) {
    logger.error('Supabase not configured for chunk processing', {
      component: 'ScanChunkProcessor',
      scanRunId: message.scanRunId,
    });
    return;
  }

  const result = await processScanChunk(message, env);

  if (result.finalized) {
    const { runFinalizer } = await import('./scanFinalizer');
    const finalizeTask = runFinalizer({
      scanRunId: message.scanRunId,
      market: message.market,
      slot: message.slot,
      triggeredBy: message.triggeredBy,
      sourceUrl: message.sourceUrl,
      env,
    });

    if (ctx && typeof ctx.waitUntil === 'function') {
      ctx.waitUntil(finalizeTask);
    } else {
      await finalizeTask;
    }
  }
}

export async function queueHandler(batch: { messages: unknown[] }, env: Env, ctx: unknown): Promise<void> {
  const typedCtx = ctx as { waitUntil?: (promise: Promise<unknown>) => void } | undefined;
  await Promise.all(batch.messages.map((msg) => {
    const body = (msg as { body?: unknown })?.body ?? msg;
    return processScanChunkMessage(body, env, typedCtx);
  }));
}
