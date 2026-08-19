import { Router } from 'express';
import { AssetClassification } from '../types/v8';
import { dbClient } from '../db/supabaseClient';
import { evaluationService } from '../pipeline/evaluationService';
import { evaluationRepository } from '../db/repositories/evaluationRepository';

export const classificationRouter = Router();

// GET /api/v8/classification
classificationRouter.get('/', (req, res) => {
  const map: Record<string, AssetClassification> = {};
  for (const [k, v] of dbClient.classifications.entries()) {
    map[k] = v;
  }
  res.json({ success: true, classifications: map });
});

// POST /api/v8/classification/override
classificationRouter.post('/override', async (req, res) => {
  try {
    const { ticker, asset_type, strategy_type, confidence, reason } = req.body;
    if (!ticker || !strategy_type) {
      return res.status(400).json({ error: 'Ticker and strategy_type required' });
    }
    const cleanTicker = ticker.toUpperCase().trim();
    const existing = dbClient.classifications.get(cleanTicker);

    const override: AssetClassification = {
      ticker: cleanTicker,
      asset_type: asset_type || 'equity',
      strategy_type,
      confidence: confidence ?? 1.0,
      classification_source: 'manual',
      reason: reason || '관리자 수동 지정 (Manual Override)',
      classified_at: existing?.classified_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    dbClient.classifications.set(cleanTicker, override);

    // Re-evaluate ticker with override
    const reEvaluated = await evaluationService.evaluateTicker(cleanTicker, override);
    const all = await evaluationRepository.getAll();
    const filtered = all.filter((e) => e.ticker !== cleanTicker);
    filtered.push(reEvaluated);
    await evaluationRepository.saveAll(filtered);

    res.json({ success: true, classification: override, evaluation: reEvaluated });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// DELETE /api/v8/classification/override/:ticker
classificationRouter.delete('/override/:ticker', async (req, res) => {
  try {
    const cleanTicker = req.params.ticker.toUpperCase().trim();
    dbClient.classifications.delete(cleanTicker);

    // Re-evaluate with auto
    const reEvaluated = await evaluationService.evaluateTicker(cleanTicker);
    const all = await evaluationRepository.getAll();
    const filtered = all.filter((e) => e.ticker !== cleanTicker);
    filtered.push(reEvaluated);
    await evaluationRepository.saveAll(filtered);

    res.json({ success: true, message: `Reset ${cleanTicker} to auto classification`, evaluation: reEvaluated });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});
