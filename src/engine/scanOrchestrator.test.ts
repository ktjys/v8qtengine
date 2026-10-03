import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getAllWatchlist, createChunkedRun, finalizeRun, sendBatch, loggerErrors } = vi.hoisted(() => ({
  getAllWatchlist: vi.fn(),
  createChunkedRun: vi.fn(),
  finalizeRun: vi.fn(),
  sendBatch: vi.fn(),
  loggerErrors: [] as string[],
}));

vi.mock('../db/repositories/watchlistRepository', () => ({
  watchlistRepository: { getAll: getAllWatchlist },
}));

vi.mock('../db/repositories/scanRunRepository', () => ({
  scanRunRepository: { createChunkedRun, finalizeRun },
}));

vi.mock('./scanChunkProcessor', () => ({
  getOptimalChunkSize: () => 2,
}));

vi.mock('../utils/logger', () => ({
  logger: {
    error: (message: string) => loggerErrors.push(message),
    warn: () => {},
    info: () => {},
    debug: () => {},
  },
}));

import { startScanJob } from './scanOrchestrator';
import type { Env } from './types';

const REAL_UUID = '3f1c9a20-1111-4222-8333-444455556666';

function env(): Env {
  return { SCAN_QUEUE: { sendBatch } } as unknown as Env;
}

const OPTIONS = { market: 'US' as const, triggeredBy: 'ManualTrigger' };

describe('startScanJob persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loggerErrors.length = 0;
    getAllWatchlist.mockResolvedValue([
      { ticker: 'AAPL', is_active: true },
      { ticker: 'MSFT', is_active: true },
      { ticker: 'NVDA', is_active: true },
    ]);
    createChunkedRun.mockImplementation(async (log: any) => ({ ...log, run_id: REAL_UUID }));
    finalizeRun.mockResolvedValue(undefined);
    sendBatch.mockResolvedValue(undefined);
  });

  it('enqueues chunks against the persisted UUID on the happy path', async () => {
    const result = await startScanJob(env(), OPTIONS);

    expect(createChunkedRun).toHaveBeenCalledTimes(1);
    expect(sendBatch).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('RUNNING');

    const bodies = sendBatch.mock.calls[0][0].map((m: any) => JSON.parse(m.body));
    expect(bodies).toHaveLength(2);
    expect(bodies.every((b: any) => b.scanRunId === REAL_UUID)).toBe(true);
    expect(bodies.map((b: any) => b.chunkIndex)).toEqual([0, 1]);
  });

  it('does not enqueue any chunk when the scan run cannot be persisted', async () => {
    createChunkedRun.mockRejectedValue(
      new Error('[db] scan_runs.createChunkedRun failed: column scan_runs.market_region does not exist')
    );

    const result = await startScanJob(env(), OPTIONS);

    expect(sendBatch).not.toHaveBeenCalled();
    expect(result.status).toBe('FAILED');
    expect(result.scanId).toBe('');
  });

  it('logs why no chunks were enqueued', async () => {
    createChunkedRun.mockRejectedValue(new Error('column scan_runs.market_region does not exist'));

    await startScanJob(env(), OPTIONS);

    expect(loggerErrors.join(' ')).toContain('no chunks enqueued');
  });

  it('still enqueues the in-memory placeholder run id, which no FK constrains', async () => {
    createChunkedRun.mockImplementation(async (log: any) => log);

    const result = await startScanJob(env(), OPTIONS);

    expect(result.status).toBe('RUNNING');
    expect(sendBatch).toHaveBeenCalledTimes(1);
  });

  it('skips an empty watchlist without touching the queue', async () => {
    getAllWatchlist.mockResolvedValue([]);

    const result = await startScanJob(env(), OPTIONS);

    expect(result.status).toBe('SKIPPED_EMPTY_WATCHLIST');
    expect(sendBatch).not.toHaveBeenCalled();
  });
});
