import { watchlistRepository } from '../db/repositories/watchlistRepository';
import { scanRunRepository } from '../db/repositories/scanRunRepository';
import { getOptimalChunkSize } from './scanChunkProcessor';
import { logger } from '../utils/logger';
import type { ScanRunLog, ScanRunStatus } from '../types/v8';
import type { Env, ScanChunkMessage, ScanMarket, ScanStartResult } from './types';

export interface OrchestratorOptions {
  market?: ScanMarket;
  triggeredBy: string;
  sourceUrl?: string;
}

function getKstTimeStr(): string {
  const nowKST = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return `${nowKST.getUTCFullYear()}-${String(nowKST.getUTCMonth() + 1).padStart(2, '0')}-${String(nowKST.getUTCDate()).padStart(2, '0')} ${String(nowKST.getUTCHours()).padStart(2, '0')}:${String(nowKST.getUTCMinutes()).padStart(2, '0')} KST`;
}

function getDefaultMarketFromKst(): ScanMarket {
  const nowKST = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const kstHour = nowKST.getUTCHours();
  const kstMinute = nowKST.getUTCMinutes();

  if ((kstHour >= 9 && kstHour < 16) || (kstHour === 16 && kstMinute <= 30)) {
    return 'KR';
  }
  return 'US';
}

function getSlotName(market: ScanMarket, kstTimeStr?: string): string {
  const nowKST = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const kstHour = nowKST.getUTCHours();
  const kstMinute = nowKST.getUTCMinutes();
  const timeStr = kstTimeStr || `${String(nowKST.getUTCHours()).padStart(2, '0')}:${String(nowKST.getUTCMinutes()).padStart(2, '0')} KST`;

  if (market === 'KR') {
    if (kstHour >= 9 && kstHour < 15) {
      return `☀️ [국내장 개장] KOSPI/KOSDAQ 시초가 & 오전 기회종목 브리핑 (${timeStr})`;
    }
    if (kstHour >= 15) {
      return `🏁 [국내장 마감] KOSPI/KOSDAQ 종가 확정 & 퀀트 리포트 (${timeStr})`;
    }
    return `☀️ [국내장 수동스캔] KOSPI/KOSDAQ 브리핑 (${timeStr})`;
  }

  if (kstHour >= 6 && kstHour <= 8) {
    return `🌅 [미국장 마감] 미국 정규장 종가 확정 브리핑 (${timeStr})`;
  }
  if (kstHour >= 22 && kstHour <= 23) {
    return `🌃 [미국장 개장] 미국 정규장 개장 & 당일 기회종목 브리핑 (${timeStr})`;
  }
  return `🌃 [미국장 수동스캔] 미국 증시 퀀트 브리핑 (${timeStr})`;
}

function isClosedMarketDay(market: ScanMarket): { closed: boolean; reason: string } {
  const nowKST = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const kstDay = nowKST.getUTCDay();
  const kstHour = nowKST.getUTCHours();
  const kstMinute = nowKST.getUTCMinutes();

  if (market === 'KR') {
    if (kstDay === 0 || kstDay === 6) {
      return { closed: true, reason: `${kstDay === 0 ? '일요일' : '토요일'}은 국내 증시 휴장일입니다.` };
    }
    return { closed: false, reason: '' };
  }

  if (kstHour >= 6 && kstHour <= 8 && (kstDay === 0 || kstDay === 1)) {
    return { closed: true, reason: `미국 증시 주말 휴장 (${kstDay === 0 ? '일요일' : '월요일'} 아침).` };
  }
  if (kstHour >= 22 && kstHour <= 23 && (kstDay === 0 || kstDay === 6)) {
    return { closed: true, reason: `미국 증시 주말 휴장 (${kstDay === 0 ? '일요일' : '토요일'} 밤).` };
  }
  void kstMinute;
  return { closed: false, reason: '' };
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

async function createTerminalRun(
  runIdPrefix: string,
  market: ScanMarket,
  status: ScanRunStatus,
  reason: string,
  meta: Record<string, unknown>
): Promise<ScanRunLog> {
  const now = new Date().toISOString();
  const log: ScanRunLog = {
    run_id: `${runIdPrefix}_${Date.now()}_${market}`,
    status,
    started_at: now,
    finished_at: now,
    watchlist_count: 0,
    evaluated_count: 0,
    signal_count: 0,
    failure_count: 0,
    error_summary: reason,
    market_region: market,
    chunk_size: 0,
    total_chunks: 0,
    completed_chunks: 0,
    failed_chunks: 0,
    meta,
  };
  try {
    return await scanRunRepository.createChunkedRun(log);
  } catch {
    return log;
  }
}

export async function startScanJob(
  env: Env,
  options: OrchestratorOptions
): Promise<ScanStartResult> {
  const market = options.market || getDefaultMarketFromKst();
  const runPrefix = options.triggeredBy.startsWith('CRON') ? 'CRON' : 'MANUAL';

  const isManual =
    options.triggeredBy === 'ManualTrigger' ||
    options.triggeredBy === 'DirectUI' ||
    options.triggeredBy === 'ManualUIOrTest' ||
    Boolean(options.sourceUrl?.includes('localhost'));

  const closedCheck = isClosedMarketDay(market);
  if (closedCheck.closed && !isManual) {
    const skipped = await createTerminalRun(
      runPrefix,
      market,
      'SKIPPED_CLOSED_MARKET',
      `시장 휴장: ${closedCheck.reason}`,
      { reason: closedCheck.reason, triggeredBy: options.triggeredBy }
    );
    return { scanId: skipped.run_id, status: 'SKIPPED_CLOSED_MARKET' };
  }

  const watchlist = await watchlistRepository.getAll();
  const tickers = Array.from(
    new Set(
      watchlist
        .filter((w) => w.is_active !== false)
        .map((w) => w.ticker.toUpperCase().trim())
        .filter((t) => {
          const region = t.endsWith('.KS') || t.endsWith('.KQ') ? 'KR' : 'US';
          return region === market;
        })
    )
  );

  if (tickers.length === 0) {
    const skipped = await createTerminalRun(
      runPrefix,
      market,
      'SKIPPED_EMPTY_WATCHLIST',
      `${market} 구독 활성 종목이 없어 스캔을 건너뜁니다.`,
      { triggeredBy: options.triggeredBy }
    );
    return { scanId: skipped.run_id, status: 'SKIPPED_EMPTY_WATCHLIST' };
  }

  const queue = env.SCAN_QUEUE;
  if (!queue) {
    await createTerminalRun(
      runPrefix,
      market,
      'FAILED',
      'SCAN_QUEUE 바인딩이 없습니다. wrangler.toml의 queues 설정을 확인하세요.',
      { triggeredBy: options.triggeredBy }
    );
    return { scanId: '', status: 'QUEUE_MISSING' };
  }

  const chunkSize = getOptimalChunkSize(market, true);
  const tickerChunks = chunkArray(tickers, chunkSize);
  const totalChunks = tickerChunks.length;
  const slot = getSlotName(market, getKstTimeStr());

  const scanRun: ScanRunLog = {
    run_id: `${runPrefix}_${Date.now()}_${market}`,
    status: 'RUNNING',
    started_at: new Date().toISOString(),
    finished_at: null,
    watchlist_count: tickers.length,
    evaluated_count: 0,
    signal_count: 0,
    failure_count: 0,
    error_summary: null,
    market_region: market,
    chunk_size: chunkSize,
    total_chunks: totalChunks,
    completed_chunks: 0,
    failed_chunks: 0,
    meta: { triggeredBy: options.triggeredBy, slot },
  };

  let scanRunId: string;
  try {
    scanRunId = (await scanRunRepository.createChunkedRun(scanRun)).run_id;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Scan run could not be persisted, no chunks enqueued', {
      component: 'ScanOrchestrator',
      market,
      error: message,
    });
    return { scanId: '', status: 'FAILED' };
  }

  const messages: ScanChunkMessage[] = tickerChunks.map((tickerChunk, index) => ({
    scanRunId,
    market,
    tickers: tickerChunk,
    chunkIndex: index,
    totalChunks,
    slot,
    triggeredBy: options.triggeredBy,
    sourceUrl: options.sourceUrl,
  }));

  try {
    await queue.sendBatch(messages.map((message) => ({ body: JSON.stringify(message) })));
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    await scanRunRepository.finalizeRun(scanRunId, {
      status: 'FAILED',
      error_summary: `큐 전송 실패: ${error}`,
    });
    return { scanId: scanRunId, status: 'QUEUE_MISSING' };
  }

  return { scanId: scanRunId, status: 'RUNNING' };
}

export { getSlotName, isClosedMarketDay, getDefaultMarketFromKst, getKstTimeStr };
