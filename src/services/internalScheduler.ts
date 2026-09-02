import { executeCronScan } from '../engine/cronScanEngine';

interface ScheduleSlot {
  id: string;
  name: string;
  targetKstHour: number;
  targetKstMinute: number;
  targetDays: number[]; // 0: Sun, 1: Mon, ..., 6: Sat
}

const SCHEDULE_SLOTS: ScheduleSlot[] = [
  {
    id: 'POST_MARKET',
    name: '🌅 미국 정규장 마감 브리핑 (종가 확정)',
    targetKstHour: 6,
    targetKstMinute: 30,
    targetDays: [1, 2, 3, 4, 5, 6], // 월~토
  },
  {
    id: 'PRE_MARKET',
    name: '🌃 프리마켓 갭 분석 & 당일 관심종목 압축',
    targetKstHour: 22,
    targetKstMinute: 0,
    targetDays: [1, 2, 3, 4, 5], // 월~금
  },
  {
    id: 'INTRADAY',
    name: '🌙 장중 급변 & 모멘텀 브레이크아웃 감시',
    targetKstHour: 2,
    targetKstMinute: 0,
    targetDays: [2, 3, 4, 5, 6], // 화~토
  },
];

class InternalScheduler {
  private timer: NodeJS.Timeout | null = null;
  private lastExecutedDateSlot: string = '';
  private isRunning: boolean = false;
  private lastRunResult: any = null;
  private isExecuting: boolean = false;

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('[InternalScheduler] 🚀 Built-in Quant Cron Scheduler started.');

    // Check every 30 seconds
    this.timer = setInterval(() => {
      this.checkAndTrigger().catch((err) => {
        console.error('[InternalScheduler] Error during scheduled check:', err);
      });
    }, 30_000);

    if (this.timer.unref) {
      this.timer.unref();
    }
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    console.log('[InternalScheduler] Stopped.');
  }

  public getStatus() {
    const nowKST = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const kstHour = nowKST.getUTCHours();
    const kstMinute = nowKST.getUTCMinutes();
    const kstDay = nowKST.getUTCDay();

    // Find next schedule
    const sorted = [...SCHEDULE_SLOTS].sort((a, b) => {
      const timeA = a.targetKstHour * 60 + a.targetKstMinute;
      const timeB = b.targetKstHour * 60 + b.targetKstMinute;
      return timeA - timeB;
    });

    const currentTimeMin = kstHour * 60 + kstMinute;
    let nextSlot = sorted.find((s) => s.targetKstHour * 60 + s.targetKstMinute > currentTimeMin);
    if (!nextSlot) nextSlot = sorted[0];

    return {
      active: this.isRunning,
      current_kst_time: `${String(kstHour).padStart(2, '0')}:${String(kstMinute).padStart(2, '0')} KST`,
      last_executed_slot: this.lastExecutedDateSlot || '없음 (대기 중)',
      last_run_result: this.lastRunResult,
      next_scheduled_slot: {
        id: nextSlot.id,
        name: nextSlot.name,
        target_time: `${String(nextSlot.targetKstHour).padStart(2, '0')}:${String(nextSlot.targetKstMinute).padStart(2, '0')} KST`,
      },
      schedules: SCHEDULE_SLOTS.map((s) => ({
        id: s.id,
        name: s.name,
        time: `${String(s.targetKstHour).padStart(2, '0')}:${String(s.targetKstMinute).padStart(2, '0')} KST`,
      })),
    };
  }

  public async triggerManual(): Promise<any> {
    console.log('[InternalScheduler] Manual trigger requested.');
    const res = await executeCronScan({
      triggeredBy: 'ManualUIOrTest',
    });
    this.lastRunResult = {
      timestamp: new Date().toISOString(),
      slot: res.slot,
      signals: res.actionable_signals_count,
      telegram: res.telegram_status?.message,
    };
    return res;
  }

  private async checkAndTrigger(): Promise<void> {
    if (this.isExecuting) return;

    const nowKST = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const kstYear = nowKST.getUTCFullYear();
    const kstMonth = nowKST.getUTCMonth() + 1;
    const kstDate = nowKST.getUTCDate();
    const kstHour = nowKST.getUTCHours();
    const kstMinute = nowKST.getUTCMinutes();
    const kstDay = nowKST.getUTCDay();

    const dateKey = `${kstYear}-${String(kstMonth).padStart(2, '0')}-${String(kstDate).padStart(2, '0')}`;

    for (const slot of SCHEDULE_SLOTS) {
      if (!slot.targetDays.includes(kstDay)) continue;

      // Match hour and minute (window of 2 minutes: minute <= kstMinute < minute + 2)
      if (kstHour === slot.targetKstHour && kstMinute >= slot.targetKstMinute && kstMinute < slot.targetKstMinute + 2) {
        const slotKey = `${dateKey}_${slot.id}`;
        if (this.lastExecutedDateSlot === slotKey) {
          // Already executed for this slot today
          continue;
        }

        console.log(`[InternalScheduler] 🔔 Triggering scheduled scan for slot: ${slot.name}`);
        this.isExecuting = true;
        this.lastExecutedDateSlot = slotKey;

        try {
          const result = await executeCronScan({
            triggeredBy: `InternalScheduler:${slot.id}`,
          });

          this.lastRunResult = {
            timestamp: new Date().toISOString(),
            slot: slot.name,
            signals: result.actionable_signals_count,
            telegram: result.telegram_status?.message,
          };

          console.log(`[InternalScheduler] ✅ Scheduled scan completed: ${result.actionable_signals_count} signals, Telegram: ${result.telegram_status?.sent}`);
        } catch (err) {
          console.error(`[InternalScheduler] ❌ Scheduled scan failed for slot ${slot.id}:`, err);
        } finally {
          this.isExecuting = false;
        }
      }
    }
  }
}

export const internalScheduler = new InternalScheduler();
