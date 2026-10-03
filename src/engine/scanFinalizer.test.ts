import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getById, finalizeRun, getAll, saveAlert, sendMessage } = vi.hoisted(() => ({
  getById: vi.fn(),
  finalizeRun: vi.fn(),
  getAll: vi.fn(),
  saveAlert: vi.fn(),
  sendMessage: vi.fn(),
}));

vi.mock('../db/repositories/scanRunRepository', () => ({
  scanRunRepository: { getById, finalizeRun },
}));

vi.mock('../db/repositories/evaluationRepository', () => ({
  evaluationRepository: { getAll },
}));

vi.mock('../db/repositories/alertHistoryRepository', () => ({
  alertHistoryRepository: { save: saveAlert },
}));

vi.mock('../notification/telegramNotifier', () => ({
  telegramNotifier: { sendMessage, getConfig: () => ({ botToken: null, chatId: null }) },
  escapeTelegramHtml: (v: unknown) => String(v),
}));

vi.mock('./dipBuyEngine', () => ({
  ensureDipEvaluation: (e: unknown) => e,
}));

import { runFinalizer } from './scanFinalizer';
import type { Env, ScanMarket } from './types';

const RUN_ID = '3f1c9a20-1111-4222-8333-444455556666';

function env(overrides: Partial<Record<string, string>> = {}): Env {
  return {
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_KEY: 'anon-key',
    TELEGRAM_BOT_TOKEN: 'bot123:abc',
    TELEGRAM_CHAT_ID: '-100999',
    ...overrides,
  } as unknown as Env;
}

async function run(overrides: Partial<Parameters<typeof runFinalizer>[0]> = {}) {
  await runFinalizer({
    scanRunId: RUN_ID,
    market: 'US' as ScanMarket,
    slot: 'test slot',
    triggeredBy: 'test',
    env: env(),
    ...overrides,
  });
}

describe('runFinalizer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAll.mockResolvedValue([]);
    sendMessage.mockResolvedValue({ success: true, previewOnly: false });
    finalizeRun.mockResolvedValue(undefined);
    saveAlert.mockResolvedValue(undefined);
  });

  it('runs even though record_scan_chunk already set the status to SUCCESS', async () => {
    getById.mockResolvedValue({
      run_id: RUN_ID,
      status: 'SUCCESS',
      watchlist_count: 0,
      evaluated_count: 0,
      signal_count: 0,
      failure_count: 0,
    });

    await run();

    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(finalizeRun).toHaveBeenCalledWith(RUN_ID, expect.any(Object));
  });

  it('runs for every terminal status the RPC can produce', async () => {
    for (const status of ['SUCCESS', 'PARTIAL_SUCCESS', 'FAILED'] as const) {
      vi.clearAllMocks();
      getAll.mockResolvedValue([]);
      sendMessage.mockResolvedValue({ success: true, previewOnly: false });
      finalizeRun.mockResolvedValue(undefined);
      getById.mockResolvedValue({ run_id: RUN_ID, status });

      await run();

      expect(sendMessage, `status ${status} must not skip the finalizer`).toHaveBeenCalledTimes(1);
    }
  });

  it('strips the bot prefix from the token before sending', async () => {
    getById.mockResolvedValue({ run_id: RUN_ID, status: 'SUCCESS' });

    await run();

    expect(sendMessage).toHaveBeenCalledWith(expect.any(String), '123:abc', '-100999');
  });

  it('does nothing when the scan run cannot be loaded', async () => {
    getById.mockResolvedValue(null);

    await run();

    expect(sendMessage).not.toHaveBeenCalled();
    expect(finalizeRun).not.toHaveBeenCalled();
  });

  it('records LOCAL_LOGGED when telegram is not configured', async () => {
    getById.mockResolvedValue({ run_id: RUN_ID, status: 'SUCCESS' });

    await run({ env: env({ TELEGRAM_BOT_TOKEN: '', TELEGRAM_CHAT_ID: '' }) });

    expect(sendMessage).not.toHaveBeenCalled();
    expect(finalizeRun).toHaveBeenCalledWith(
      RUN_ID,
      expect.objectContaining({ error_summary: expect.stringContaining('텔레그램 미설정') })
    );
  });

  it('marks the run FAILED when the finalizer itself throws', async () => {
    getById.mockResolvedValue({ run_id: RUN_ID, status: 'SUCCESS' });
    getAll.mockRejectedValue(new Error('boom'));

    await run();

    expect(finalizeRun).toHaveBeenCalledWith(
      RUN_ID,
      expect.objectContaining({ status: 'FAILED' })
    );
  });
});
