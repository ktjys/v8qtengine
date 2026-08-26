import { AssetClassification, FullTickerEvaluation, WatchlistItem } from '../types/v8';
import { scanService } from './scanService';
import { evaluationService } from './evaluationService';
import { PipelineExecutionOptions, PipelineScanResult } from './pipelineTypes';
import { watchlistRepository } from '../db/repositories/watchlistRepository';
import { evaluationRepository } from '../db/repositories/evaluationRepository';
import { runV8PipelineOnSeedData } from '../data/seed/initialData';

export async function runV8Pipeline(
  options: PipelineExecutionOptions = {},
  manualOverrides: Record<string, AssetClassification> = {}
): Promise<PipelineScanResult> {
  return scanService.executeScan(options, manualOverrides);
}

export async function getInitialOrLatestEvaluations(
  manualOverrides: Record<string, AssetClassification> = {}
): Promise<{
  evaluations: FullTickerEvaluation[];
  watchlist: WatchlistItem[];
}> {
  const existing = await evaluationRepository.getAll();
  const watchlist = await watchlistRepository.getAll();

  return { evaluations: existing, watchlist };
}
