import { Router } from 'express';
import { scanService } from '../pipeline/scanService';
import { dbClient } from '../db/supabaseClient';
import { AssetClassification } from '../types/v8';

export const scanRouter = Router();

// POST /api/v8/scan/run
scanRouter.post('/run', async (req, res) => {
  try {
    const simulatePartialFailure = req.body.simulate_partial_failure === true;
    const providerType = req.body.provider_type as 'yahoo' | 'seed' | undefined;

    const manualOverrides: Record<string, AssetClassification> = {};
    for (const [k, v] of dbClient.classifications.entries()) {
      manualOverrides[k] = v;
    }

    const result = await scanService.executeScan(
      { simulatePartialFailure, providerType, saveToDb: true },
      manualOverrides
    );

    res.json({
      success: true,
      scan_log: result.runLog,
      new_signals: result.newSignals,
      evaluations_count: result.evaluations.length,
      evaluations: result.evaluations,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});
