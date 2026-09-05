import { AssetClassification, FullTickerEvaluation } from '../types/v8';
import { MarketDataService, ProcessedAssetData, marketDataService as defaultMarketDataService } from '../data/marketDataService';
import { classifyAsset } from '../engine/classificationEngine';
import { evaluateV8, MarketSnapshot } from '../engine/evaluateV8';

export class EvaluationService {
  private marketDataService: MarketDataService;

  constructor(marketDataService?: MarketDataService) {
    this.marketDataService = marketDataService || defaultMarketDataService;
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

    // 독립 출처 추적: 시장/펀더멘털/분류 각각의 실제 출처를 정직하게 기록한다.
    // 펀더멘털이 seed baseline이면 차단하지 않고 warnings로만 표시한다.
    // (시장/OHLCV 폴백만 isFallback 하드 게이트로 신호를 차단한다.)
    const provenanceWarnings: string[] = [];
    if (processed.fundamentalDataSource === 'seed') {
      provenanceWarnings.push('fundamentals sourced from seed baseline');
    }

    const evaluation = evaluateV8({
      ticker: processed.ticker,
      evaluationAt: new Date(),
      market,
      classification,
      dataQuality: processed.dataQuality,
      provenance: {
        source: processed.normalized.source,
        isFallback: processed.isFallback,
        marketDataSource: processed.marketDataSource,
        fundamentalDataSource: processed.fundamentalDataSource,
        classificationSource: classification.classification_source,
        warnings: provenanceWarnings,
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
      provenance: {
        source: processed.normalized.source,
        isFallback: processed.isFallback,
        marketDataSource: processed.marketDataSource,
        fundamentalDataSource: processed.fundamentalDataSource,
        classificationSource: classification.classification_source,
        warnings: provenanceWarnings,
      },
      raw_metadata: processed.rawMetadata,
    };
  }

  async evaluateBatch(
    tickers: string[],
    manualOverrides: Record<string, AssetClassification> = {}
  ): Promise<{ evaluations: FullTickerEvaluation[]; failed: { ticker: string; error: string }[] }> {
    const evaluations: FullTickerEvaluation[] = [];
    const failed: { ticker: string; error: string }[] = [];

    const BATCH_SIZE = 5;
    for (let i = 0; i < tickers.length; i += BATCH_SIZE) {
      const chunk = tickers.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        chunk.map(async (t) => {
          try {
            const result = await this.evaluateTicker(t, manualOverrides[t.toUpperCase()]);
            return { evaluation: result };
          } catch (err) {
            return {
              failed: {
                ticker: t.toUpperCase(),
                error: (err as Error).message || 'Evaluation process failed',
              },
            };
          }
        })
      );

      for (const res of results) {
        if (res.evaluation) {
          evaluations.push(res.evaluation);
        }
        if (res.failed) {
          failed.push(res.failed);
        }
      }
    }

    return { evaluations, failed };
  }
}

export const evaluationService = new EvaluationService();
