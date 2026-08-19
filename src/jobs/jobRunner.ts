import { runDailyMarketSync } from './dailyMarketSync';
import { runDailyScanJob } from './dailyScan';
import { updateSignalOutcomes } from './signalOutcomeUpdater';

export class JobRunner {
  private isRunning = false;

  async runFullDailyAutomationCycle() {
    if (this.isRunning) {
      console.log('[JobRunner] Cycle already in progress, skipping.');
      return;
    }

    this.isRunning = true;
    console.log('[JobRunner] Starting full automated daily cycle...');

    try {
      // 1. Market Data Sync
      console.log('[JobRunner] Step 1: Syncing market data...');
      const syncRes = await runDailyMarketSync();
      console.log(`[JobRunner] Synced ${syncRes.syncedCount} tickers.`);

      // 2. Scan Universe & Generate Signals
      console.log('[JobRunner] Step 2: Running V8 evaluation scan...');
      const scanRes = await runDailyScanJob();
      console.log(`[JobRunner] Evaluated ${scanRes.evaluations.length} tickers, ${scanRes.newSignals.length} new signals.`);

      // 3. Update Existing Signal Outcomes (Forward returns)
      console.log('[JobRunner] Step 3: Updating historical signal outcomes...');
      const outcomeRes = await updateSignalOutcomes();
      console.log(`[JobRunner] Updated outcomes for ${outcomeRes.updatedCount} signals.`);

      console.log('[JobRunner] Daily cycle completed successfully.');
    } catch (err) {
      console.error('[JobRunner] Daily cycle encountered error:', err);
    } finally {
      this.isRunning = false;
    }
  }
}

export const jobRunner = new JobRunner();
