import { AssetClassification, FullTickerEvaluation } from '../types/v8';
import { MarketDataService, ProcessedAssetData } from '../data/marketDataService';
import { classifyAsset } from '../engine/classificationEngine';
import { evaluateV8, MarketSnapshot } from '../engine/evaluateV8';

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

  async getLiveQuote(ticker: string) {
    return this.marketDataService.getQuote(ticker);
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

    // 2~4. 단일 순수 평가 함수 evaluateV8() 사용 (라이브/백테스트 공용)
    const market: MarketSnapshot = {
      price: processed.price,
      change1d: processed.change1d,
      indicators: processed.indicators,
      riskInputs: processed.riskInputs,
    };

    const evaluation = evaluateV8({
      ticker: processed.ticker,
      evaluationAt: new Date(),
      market,
      classification,
      dataQuality: processed.dataQuality,
      provenance: {
        source: processed.normalized.source,
        isFallback: processed.isFallback,
      },
    });

    return {
      ticker: processed.ticker,
      name: processed.name,
      price: processed.price,
      change1d: processed.change1d,
      evaluated_at: new Date().toISOString(),
      classification: evaluation.classification,
      opportunity: evaluation.opportunity,
      risk: evaluation.risk,
      decision: evaluation.decision,
      signal_generated: evaluation.isSignal,
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
