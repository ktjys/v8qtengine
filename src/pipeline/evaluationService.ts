import { AssetClassification, FullTickerEvaluation } from '../types/v8';
import { MarketDataService, ProcessedAssetData } from '../data/marketDataService';
import { classifyAsset } from '../engine/classificationEngine';
import { calculateOpportunity } from '../engine/opportunityEngine';
import { calculateRisk } from '../engine/riskEngine';
import { makeDecision } from '../engine/decisionEngine';

export class EvaluationService {
  private marketDataService: MarketDataService;

  constructor(marketDataService?: MarketDataService) {
    this.marketDataService = marketDataService || new MarketDataService();
  }

  setProvider(providerType: 'yahoo' | 'seed') {
    this.marketDataService.setProvider(providerType);
  }

  getProviderName(): string {
    return this.marketDataService.getProviderName();
  }

  async evaluateTicker(
    ticker: string,
    existingClassification?: AssetClassification
  ): Promise<FullTickerEvaluation> {
    const isEtfHint = existingClassification?.asset_type === 'etf';
    const processed: ProcessedAssetData = await this.marketDataService.processTicker(
      ticker,
      isEtfHint
    );

    // 1. Classification Engine (Manual Override protected)
    const classification = classifyAsset(
      processed.ticker,
      processed.rawMetadata,
      existingClassification
    );

    // 2. Opportunity Engine
    const opportunity = calculateOpportunity(classification, processed.indicators);

    // 3. Risk Engine
    const risk = calculateRisk(classification, processed.riskInputs);

    // 4. Decision Engine
    const decision = makeDecision(classification, opportunity, risk);

    return {
      ticker: processed.ticker,
      name: processed.name,
      price: processed.price,
      change1d: processed.change1d,
      evaluated_at: new Date().toISOString(),
      classification,
      opportunity,
      risk,
      decision,
      signal_generated: decision.actionable,
      data_quality: processed.dataQuality,
      raw_metadata: processed.rawMetadata,
    };
  }

  async evaluateBatch(
    tickers: string[],
    manualOverrides: Record<string, AssetClassification> = {}
  ): Promise<{ evaluations: FullTickerEvaluation[]; failed: { ticker: string; error: string }[] }> {
    const evaluations: FullTickerEvaluation[] = [];
    const failed: { ticker: string; error: string }[] = [];

    for (const t of tickers) {
      try {
        const result = await this.evaluateTicker(t, manualOverrides[t.toUpperCase()]);
        evaluations.push(result);
      } catch (err) {
        failed.push({
          ticker: t.toUpperCase(),
          error: (err as Error).message || 'Evaluation process failed',
        });
      }
    }

    return { evaluations, failed };
  }
}

export const evaluationService = new EvaluationService();
