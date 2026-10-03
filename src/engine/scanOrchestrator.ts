import { watchlistRepository } from '../db/repositories/watchlistRepository';
import { scanRunRepository } from '../db/repositories/scanRunRepository';
import { detectMarketRegion } from '../utils/marketUtils';
import { ScanRunLog } from '../types/v8';
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
}

interface OrchestratorOptions {
  market?: 'US' | 'KR';
  triggeredBy: string;
  sourceUrl?: string;
  botToken?: string;
  chatId?: string;
}

function getKstTimeStr(): string {
  const nowKST = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return `${nowKST.getUTCFullYear()}-${String(nowKST.getUTCMonth() + 1).padStart(2, '0')}-${String(nowKST.getUTCDate()).padStart(2, '0')} ${String(nowKST.getUTCHours()).padStart(2, '0')}:${String(nowKST.getUTCMinutes()).padStart(2, '0')} KST`;
}

function getDefaultMarketFromKst(): 'US' | 'KR' {
  const nowKST = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const kstHour = nowKST.getUTCHours();
  const kstMinute = nowKST.getUTCMinutes();

  if ((kstHour >= 9 && kstHour < 16) || (kstHour === 16 && kstMinute <= 30)) {
    return 'KR';
  }
  return 'US';
}

function getSlotName(market: 'US' | 'KR', kstTimeStr?: string): string {
  const nowKST = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const kstHour = nowKST.getUTCHours();
  const kstMinute = nowKST.getUTCMinutes();
  const kstDay = nowKST.getUTCDay(); // 0: Sun, 1: Mon...

  const timeStr = kstTimeStr || `${String(nowKST.getUTCHours()).padStart(2, '0')}:${String(nowKST.getUTCMinutes()).padStart(2, '0')} KST`;

  if (market === 'KR') {
    if (kstHour >= 9 && kstHour <= 15) {
      return `☀️ [국내장 개장] KOSPI/KOSDAQ 시초가 & 오전 기회종목 브리핑 (${timeStr})`;
    }
    if (kstHour >= 15 && kstMinute >= 30) {
      return `🏁 [국내장 마감] KOSPI/KOSDAQ 종가 확정 & 퀀트 리포트 (${timeStr})`;
    }
    return `☀️ [국내장 수동스캔] KOSPI/KOSDAQ 브리핑 (${timeStr})`;
  } else {
    if (kstHour >= 6 && kstHour <= 8) {
      return `🌅 [미국장 마감] 미국 정규장 종가 확정 브리핑 (${timeStr})`;
    }
    if (kstHour >= 22 && kstHour <= 23) {
      return `🌃 [미국장 개장] 미국 정규장 개장 & 당일 기회종목 브리핑 (${timeStr})`;
    }
    return `🌃 [미국장 수동스캔] 미국 증시 퀀트 브리핑 (${timeStr})`;
  }
}

function isClosedMarketDay(market: 'US' | 'KR'): { closed: boolean; reason: string } {
  const nowKST = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const kstDay = nowKST.getUTCDay(); // 0: Sun, 1: Mon...
  const kstHour = nowKST.getUTCHours();
  const kstMinute = nowKST.getUTCMinutes();

  if (market === 'KR') {
    if (kstDay === 0 || kstDay === 6) {
      return { closed: true, reason: `${kstDay === 0 ? '일요일' : '토요일'}은 국내 증시 휴장일입니다.` };
    }
  } else {
    if ((kstHour >= 6 && kstHour <= 8) && (kstDay === 0 || kstDay === 1)) {
      return { closed: true, reason: `미국 증시 주말 휴장 (${kstDay === 0 ? '일요일' : '월요일'} 아침).` };
    }
    if ((kstHour >= 22 && kstHour <= 23) && (kstDay === 0 || kstDay === 6)) {
      return { closed: true, reason: `미국 증시 주말 휴장 (${kstDay === 0 ? '일요일' : '토요일'} 밤).` };
    }
  }
  return { closed: false, reason: '' };
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

export async function startScanJob(
  env: Env,
  options: OrchestratorOptions
): Promise<{ scanId: string; status: string }> {
  const market = options.market || getDefaultMarketFromKst();
  const kstTimeStr = getKstTimeStr();

  // Closed market guard for non-manual triggers
  const isManual = options.triggeredBy === 'ManualTrigger' ||
    options.triggeredBy === 'DirectUI' ||
    options.triggeredBy === 'ManualUIOrTest' ||
    options.sourceUrl?.includes('localhost');

  const closedCheck = isClosedMarketDay(market);
  if (closedCheck.closed && !isManual) {
    // Create a skipped scan run for tracking
    const skippedRun: import('../types/v8').ScanRunLog = {
      run_id: `SKIP_${Date.now()}`,
      status: 'SKIPPED_CLOSED_MARKET',
      started_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
      watchlist_count: 0,
      evaluated_count: 0,
      signal_count: 0,
      failure_count: 0,
      error_summary: `시장 휴장: ${closedCheck.reason}`,
      market_region: market,
      chunk_size: 0,
      total_chunks: 0,
      completed_chunks: 0,
      failed_chunks: 0,
      meta: { reason: closedCheck.reason },
    };
    await import('../db/repositories/scanRunRepository').then(m => m.scanRunRepository.createChunkedRun(skippedRun));
    return { scanId: skippedRun.run_id, status: 'SKIPPED_CLOSED_MARKET' };
  }

  // Load active watchlist
  const watchlist = await import('../db/repositories/watchlistRepository').then(m => m.watchlistRepository.getAll());
  const activeOnly = watchlist.filter((w) => w.is_active !== false);
  const tickers = activeOnly
    .map((w) => w.ticker.toUpperCase().trim())
    .filter((t) => {
      const region = t.endsWith('.KS') || t.endsWith('.KQ') ? 'KR' : 'US';
      return region === market;
    });

  // Fallback tickers if empty
  let tickersToScan = tickers.length > 0
    ? Array.from(new Set(tickers))
    : (market === 'KR'
      ? ['005930.KS', '000660.KS', '373220.KS', '207940.KS', '005380.KS', '069500.KS', '360750.KS', '133690.KS', '458730.KS', '247540.KQ', '196170.KQ']
      : ['AAPL', 'AMD', 'AMZN', 'GOOGL', 'HOOD', 'JNJ', 'META', 'MSFT', 'NVDA', 'OKLO', 'ORCL', 'PLTR', 'QQQ', 'SCHD', 'SMCX', 'SPY', 'TSLA', 'V', 'VOO']);

  // Chunking
  const chunkSize = market === 'US' ? 2 : 3;
  const tickerChunks = chunkArray(tickersToScan, chunkSize);
  const totalChunks = tickerChunks.length;

  // Create scan run record
  const runId = `CRON_${Date.now()}_${market}`;
  const slotName = getSlotName(market);
  const scanRun = {
    run_id: runId,
    status: 'RUNNING',
    started_at: new Date().toISOString(),
    finished_at: null,
    watchlist_count: tickersToScan.length,
    evaluated_count: 0,
    signal_count: 0,
    failure_count: 0,
    error_summary: null,
    market_region: market,
    chunk_size: chunkSize,
    total_chunks: tickerChunks.length,
    completed_chunks: 0,
    failed_chunks: 0,
    meta: { triggeredBy: options.triggeredBy, sourceUrl: options.sourceUrl, botToken: options.botToken, chatId: options.chatId },
  };

  await import('../db/repositories/scanRunRepository').then(m => m.scanRunRepository.createChunkedRun(scanRun as any));

  // Enqueue chunks to queue
  const queue = (globalThis as any).SCAN_QUEUE || (globalThis as any).SCAN_QUEUE;
  if (!queue) {
    console.error('[ScanOrchestrator] SCAN_QUEUE binding not found');
    // Update scan run as failed
    await import('../db/repositories/scanRunRepository').then(m => m.scanRunRepository.recordChunk(
      tickerChunks.length > 0 ? 'FAILED' : 'SUCCESS',
      0, 0, tickerChunks.length
    ));
    return { scanId: '', status: 'QUEUE_MISSING' };
  }

  const messages = tickerChunks.map((chunk, index) => ({
    scanRunId: scanRun.run_id,
    market,
    tickers: chunk,
    chunkIndex: index,
    totalChunks: tickerChunks.length,
    slot: getSlotName(market),
    triggeredBy: options.triggeredBy,
    sourceUrl: options.sourceUrl,
    botToken: undefined, // will be passed from env
    chatId: undefined,
  }));

  // Enqueue messages
  const queueMessages = messages.map(msg => ({
    body: JSON.stringify(msg),
  }));

  await queue.sendBatch(queueMessages);

  return { scanId: scanRun.run_id, status: 'RUNNING' };
}

export { getSlotName, isClosedMarketDay, getDefaultMarketFromKst, getKstTimeStr };