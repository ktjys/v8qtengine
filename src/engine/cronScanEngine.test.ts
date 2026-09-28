import { describe, it, expect, vi } from 'vitest';
import { executeCronScan } from './cronScanEngine';
import { scanService } from '../pipeline/scanService';

describe('cronScanEngine — 주말/휴장일 가드 및 시장 격리', () => {
  it('일요일 또는 토요일에 자동 스케줄러가 KR 시장 스캔을 호출하면 휴장일 가드로 안전하게 스킵된다', async () => {
    // 2026-09-27 is Sunday (UTC & KST day 0)
    const sundayDate = new Date('2026-09-27T00:30:00Z'); // 09:30 KST Sunday
    vi.useFakeTimers();
    vi.setSystemTime(sundayDate);

    const result = await executeCronScan({
      market: 'KR',
      triggeredBy: 'CloudflareCron:30 0 * * 1-5',
    });

    expect(result.success).toBe(true);
    expect(result.evaluated_count).toBe(0);
    expect(result.telegram_status.sent).toBe(false);
    expect(result.telegram_status.message).toContain('휴장일 알림 스킵');
    expect(result.telegram_status.message).toContain('일요일');

    vi.useRealTimers();
  });

  it('사용자가 UI나 수동 테스트로 호출한 경우 휴장일 가드를 우회하여 즉시 실행을 허용한다', async () => {
    // Sunday
    const sundayDate = new Date('2026-09-27T00:30:00Z');
    vi.useFakeTimers();
    vi.setSystemTime(sundayDate);

    // Mock scanService to avoid actual slow network execution in test
    vi.spyOn(scanService, 'executeScan').mockResolvedValueOnce({
      evaluations: [],
      watchlist: [],
      newSignals: [],
      allSignals: [],
      runLog: {} as any,
    });

    const resultPromise = executeCronScan({
      market: 'KR',
      triggeredBy: 'ManualUIOrTest',
    });

    // Should not be skipped immediately with 휴장일 알림 스킵
    // It will proceed to execute scan
    const res = await resultPromise;
    expect(res.telegram_status.message).not.toContain('휴장일 알림 스킵');

    vi.useRealTimers();
  });
});
