import { scanService } from '../pipeline/scanService';
import { notificationService } from '../notification/notificationService';
import { PipelineScanResult } from '../pipeline/pipelineTypes';

export async function runDailyScanJob(): Promise<PipelineScanResult> {
  const result = await scanService.executeScan({ saveToDb: true });

  // If there are new signals, trigger notifications
  for (const sig of result.newSignals) {
    await notificationService.notifySignal(sig);
  }

  return result;
}
