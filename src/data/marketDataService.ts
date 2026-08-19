import { MarketDataProvider } from './providers/marketDataProvider';
import { YahooFinanceProvider } from './providers/yahooFinanceProvider';
import { SeedDataProvider } from './seed/seedProvider';
import { NormalizedMarketData, OHLCVBar } from './providers/types';
import { calculateTechnicalIndicators } from './indicators/technicalIndicators';
import { calculateMomentumIndicators } from './indicators/momentumIndicators';
import { extractFundamentalIndicators } from './indicators/fundamentalIndicators';
import { RawMarketIndicators } from '../engine/opportunityEngine';
import { RawRiskInputs } from '../engine/riskEngine';
import { RawYahooMetadata } from '../engine/classificationEngine';
import { evaluateDataQuality } from './validation/freshnessValidator';
import { DataQualityReport } from '../types/v8';

export interface ProcessedAssetData {
  ticker: string;
  name: string;
  price: number;
  change1d: number;
  rawMetadata: RawYahooMetadata;
  indicators: RawMarketIndicators;
  riskInputs: RawRiskInputs;
  dataQuality: DataQualityReport;
  normalized: NormalizedMarketData;
}

export class MarketDataService {
  private provider: MarketDataProvider;
  private benchmarkBarsCache: OHLCVBar[] | null = null;
  private benchmarkLastFetched = 0;

  constructor(providerType?: 'yahoo' | 'seed') {
    const selected = providerType || (process.env.V8_DATA_PROVIDER === 'seed' ? 'seed' : 'yahoo');
    if (selected === 'seed') {
      this.provider = new SeedDataProvider();
    } else {
      this.provider = new YahooFinanceProvider();
    }
  }

  setProvider(providerType: 'yahoo' | 'seed') {
    if (providerType === 'seed') {
      this.provider = new SeedDataProvider();
    } else {
      this.provider = new YahooFinanceProvider();
    }
  }

  getProviderName(): string {
    return this.provider.name;
  }

  async getBenchmarkBars(): Promise<OHLCVBar[]> {
    const now = Date.now();
    if (this.benchmarkBarsCache && now - this.benchmarkLastFetched < 1000 * 60 * 10) {
      return this.benchmarkBarsCache;
    }
    const bars = await this.provider.getBenchmark('1y');
    this.benchmarkBarsCache = bars;
    this.benchmarkLastFetched = now;
    return bars;
  }

  async processTicker(ticker: string, isEtfHint = false): Promise<ProcessedAssetData> {
    const cleanTicker = ticker.toUpperCase().trim();
    const benchmarkBars = await this.getBenchmarkBars();
    const normalized = await this.provider.getNormalizedMarketData(cleanTicker, benchmarkBars);

    const tech = calculateTechnicalIndicators(normalized.bars);
    const mom = calculateMomentumIndicators(normalized.bars, benchmarkBars);
    const fund = extractFundamentalIndicators(normalized.fundamentals, isEtfHint);

    const rawMetadata: RawYahooMetadata = {
      quoteType: normalized.fundamentals.quoteType,
      shortName: normalized.quote.shortName,
      longName: normalized.quote.longName,
      sector: normalized.fundamentals.sector,
      industry: normalized.fundamentals.industry,
      marketCap: normalized.fundamentals.marketCap,
      revenueGrowth: normalized.fundamentals.revenueGrowthYoy,
      earningsGrowth: normalized.fundamentals.earningsGrowthYoy,
      beta: mom.beta || normalized.fundamentals.beta || 1.0,
      trailingPE: normalized.fundamentals.trailingPe,
      forwardPE: normalized.fundamentals.forwardPe,
      dividendYield: normalized.fundamentals.dividendYield,
    };

    const indicators: RawMarketIndicators = {
      price: normalized.quote.price,
      ma20: tech.ma20,
      ma50: tech.ma50,
      ma200: tech.ma200,
      rsi14: tech.rsi14,
      drawdownFromHigh: tech.drawdownFromHigh,
      macdHistogramPositive: tech.macdHistogramPositive,
      return1M: mom.return1M,
      return3M: mom.return3M,
      return6M: mom.return6M,
      relativeStrengthVsSpy: mom.relativeStrengthVsSpy,
      revenueGrowthYoy: fund.revenueGrowthYoy,
      earningsGrowthYoy: fund.earningsGrowthYoy,
      operatingMargin: fund.operatingMargin,
      freeCashFlowMargin: fund.freeCashFlowMargin,
      marketCapBillions: fund.marketCapBillions,
      trailingPe: fund.trailingPe,
      forwardPe: fund.forwardPe,
      psRatio: fund.psRatio,
      pegRatio: fund.pegRatio,
    };

    const riskInputs: RawRiskInputs = {
      beta: mom.beta,
      volatility20dAnnualized: mom.volatility20dAnnualized,
      maxDrawdown52w: tech.drawdownFromHigh,
      rsi14: tech.rsi14,
      priceBelowMa200: tech.priceBelowMa200,
      missingDataPoints: normalized.bars.length < 200 ? 1 : 0,
    };

    const isEtf = normalized.fundamentals.quoteType === 'ETF' || isEtfHint;
    const dataQuality = evaluateDataQuality(normalized, isEtf);

    return {
      ticker: cleanTicker,
      name: normalized.quote.longName || normalized.quote.shortName || cleanTicker,
      price: normalized.quote.price,
      change1d: normalized.quote.changePercent,
      rawMetadata,
      indicators,
      riskInputs,
      dataQuality,
      normalized,
    };
  }

  async processBatch(tickers: string[]): Promise<ProcessedAssetData[]> {
    const results: ProcessedAssetData[] = [];
    const benchmarkBars = await this.getBenchmarkBars();

    // Process in batches of 4 to prevent rate limiting
    const batchSize = 4;
    for (let i = 0; i < tickers.length; i += batchSize) {
      const chunk = tickers.slice(i, i + batchSize);
      const chunkResults = await Promise.all(
        chunk.map(async (t) => {
          try {
            return await this.processTicker(t);
          } catch (err) {
            console.error(`Failed to process ticker ${t}:`, err);
            // Fallback to seed for this item
            const seedProv = new SeedDataProvider();
            const norm = await seedProv.getNormalizedMarketData(t, benchmarkBars);
            const tech = calculateTechnicalIndicators(norm.bars);
            const mom = calculateMomentumIndicators(norm.bars, benchmarkBars);
            const fund = extractFundamentalIndicators(norm.fundamentals, false);

            return {
              ticker: t.toUpperCase(),
              name: t.toUpperCase(),
              price: norm.quote.price,
              change1d: norm.quote.changePercent,
              rawMetadata: {},
              indicators: {
                price: norm.quote.price,
                ma20: tech.ma20,
                ma50: tech.ma50,
                ma200: tech.ma200,
                rsi14: tech.rsi14,
                drawdownFromHigh: tech.drawdownFromHigh,
                macdHistogramPositive: tech.macdHistogramPositive,
                return1M: mom.return1M,
                return3M: mom.return3M,
                return6M: mom.return6M,
                relativeStrengthVsSpy: mom.relativeStrengthVsSpy,
                marketCapBillions: 10,
              },
              riskInputs: {
                beta: 1.0,
                volatility20dAnnualized: 0.25,
                maxDrawdown52w: -0.15,
                rsi14: 50,
                priceBelowMa200: false,
              },
              dataQuality: {
                data_quality_score: 50,
                data_freshness: 'RECENT',
                last_updated: new Date().toISOString(),
                source: 'seed',
                data_warnings: ['데이터 로드 오류로 Seed 백업 데이터 대체'],
                bars_count: norm.bars.length,
                has_fundamentals: false,
              },
              normalized: norm,
            } as ProcessedAssetData;
          }
        })
      );
      results.push(...chunkResults);
    }
    return results;
  }
}
