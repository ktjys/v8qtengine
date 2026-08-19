import { Router } from 'express';
import { dbClient } from '../db/supabaseClient';
import { evaluationService } from '../pipeline/evaluationService';

export const systemRouter = Router();

// GET /api/v8/system/status
systemRouter.get('/status', (req, res) => {
  const dbStatus = dbClient.getStatus();
  res.json({
    success: true,
    engine_version: 'V8.0-PROD',
    provider: evaluationService.getProviderName(),
    db: dbStatus,
    timestamp: new Date().toISOString(),
    uptime_seconds: process.uptime(),
  });
});

// POST /api/v8/system/provider
systemRouter.post('/provider', (req, res) => {
  const { provider } = req.body;
  if (provider === 'seed' || provider === 'yahoo') {
    evaluationService.setProvider(provider);
    res.json({ success: true, active_provider: provider });
  } else {
    res.status(400).json({ error: "Invalid provider. Must be 'yahoo' or 'seed'." });
  }
});
