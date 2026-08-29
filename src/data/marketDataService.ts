import { MarketDataProvider } from './providers/marketDataProvider';
import { YahooFinanceProvider } from './providers/yahooFinanceProvider';
import { SeedDataProvider } from './seed/seedProvider';
import { FundamentalData, NormalizedMarketData, OHLCVBar, QuoteData } from './providers/types';
import { calculateTechnicalIndicators } from './indicators/technicalIndicators';
import { calculateMomentumIndicators } from './indicators/momentumIndicators';
import { extractFundamentalIndicators } from './indicators/fundamentalIndicators';
import { RawMarketIndicators } from '../engine/opportunityEngine';
import { RawRiskInputs } from '../engine/riskEngine';
import { RawYahooMetadata } from '../engine/classificationEngine';
import { evaluateDataQuality } from './validation/freshnessValidator';
import { DataQualityReport } from '../types/v8';
import { marketDataRepository } from '../db/repositories/marketDataRepository';
import { fundamentalsRepository } from '../db/repositories/fundamentalsRepository';
import { assetRepository } from '../db/repositories/assetRepository';
import { indicatorRepository } from '../db/repositories/indicatorRepository';
import { dbClient } from '../db/supabaseClient';

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
  /** 실제 데이터 수집 실패로 seed 폴백이 사용되었는지 여부 (시장/OHLCV 신호 게이트 입력). */
  isFallback: boolean;
  /** OHLCV 시장 데이터의 실제 출처 (yahoo / seed / database). */
  marketDataSource: string;
  /** 펀더멘털 데이터의 실제 출처 (yahoo / seed / database). */
  fundamentalDataSource: string;
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
    if (dbClient.isSupabaseConnected) {
      return `Supabase DB (${this.provider.name})`;
    }
    return this.provider.name;
  }

  async getQuote(ticker: string): Promise<QuoteData> {
    const cleanTicker = ticker.toUpperCase().trim();
    return this.provider.getQuote(cleanTicker);
  }

  async getBenchmarkBars(): Promise<OHLCVBar[]> {
    const now = Date.now();
    if (this.benchmarkBarsCache && now - this.benchmarkLastFetched < 1000 * 60 * 10) {
      return this.benchmarkBarsCache;
    }

    // 1. Check DB first for SPY
    let dbBars = await marketDataRepository.getBars('SPY', 252);
    const lastDate = dbBars.length > 0 ? new Date(dbBars[dbBars.length - 1].date).getTime() : 0;
    const isStale = dbBars.length < 200 || isNaN(lastDate) || (now - lastDate > 24 * 60 * 60 * 1000);

    if (isStale) {
      const bars = await this.provider.getBenchmark('1y');
      if (bars.length > 0) {
        // Provider may have internally fallen back to seed (e.g. Yahoo -> seed);
        // persist the honest source so SPY provenance is not mislabeled as real data.
        const usedFallback = this.provider.name === 'yahoo' && !!this.provider.getHadFallback?.();
        await marketDataRepository.saveBars('SPY', bars, usedFallback ? 'seed' : this.provider.name);
        dbBars = bars;
      }
    }

    this.benchmarkBarsCache = dbBars;
    this.benchmarkLastFetched = now;
    return dbBars;
  }

  async processTicker(ticker: string, isEtfHint = false): Promise<ProcessedAssetData> {
    const cleanTicker = ticker.toUpperCase().trim();
    const benchmarkBars = await this.getBenchmarkBars();

    // Yahoo 폴백 플래그 초기화: 이 종목 처리 중 실제 폴백 여부를 정직하게 추적
    if (this.provider.name === 'yahoo' && this.provider.getHadFallback) {
      this.provider.resetFallbackFlag && this.provider.resetFallbackFlag();
    }

    // 1. Always fetch live real-time quote first
    const liveQuote = await this.provider.getQuote(cleanTicker);

    // 2. Fetch historical bars from DB or live provider, verifying freshness (< 24h)
    let dbBars = await marketDataRepository.getBars(cleanTicker, 252);
    const lastDate = dbBars.length > 0 ? new Date(dbBars[dbBars.length - 1].date).getTime() : 0;
    const isStale = dbBars.length < 200 || isNaN(lastDate) || (Date.now() - lastDate > 24 * 60 * 60 * 1000);

    if (isStale) {
      const fetchedBars = await this.provider.getHistorical(cleanTicker, '1y');
      if (fetchedBars && fetchedBars.length > 0) {
        // Provider may have internally fallen back to seed (e.g. Yahoo -> seed);
        // persist the honest source so provenance is not mislabeled as real data.
        const usedFallback = this.provider.name === 'yahoo' && !!this.provider.getHadFallback?.();
        await marketDataRepository.saveBars(cleanTicker, fetchedBars, usedFallback ? 'seed' : this.provider.name);
        dbBars = fetchedBars;
      }
    }

    // 3. Synchronize / enrich latest bar with current live price
    if (liveQuote && liveQuote.price > 0) {
      if (dbBars.length > 0) {
        const quoteDate = liveQuote.timestamp ? liveQuote.timestamp.split('T')[0] : new Date().toISOString().split('T')[0];
        const lastBar = dbBars[dbBars.length - 1];
        if (lastBar.date === quoteDate) {
          lastBar.close = liveQuote.price;
          lastBar.high = Math.max(lastBar.high, liveQuote.price);
          lastBar.low = Math.min(lastBar.low, liveQuote.price);
        } else if (quoteDate >= lastBar.date) {
          dbBars.push({
            date: quoteDate,
            open: Math.round((liveQuote.price - (liveQuote.change || 0)) * 100) / 100,
            high: Math.max(liveQuote.price, liveQuote.price - (liveQuote.change || 0)),
            low: Math.min(liveQuote.price, liveQuote.price - (liveQuote.change || 0)),
            close: liveQuote.price,
            adjClose: liveQuote.price,
            volume: 100000,
          });
        }
      }
    }

    // 4. Fetch fundamentals from DB or provider
    const dbFund = await fundamentalsRepository.getLatest(cleanTicker);
    const dbAsset = await assetRepository.findByTicker(cleanTicker);

    let fundData: FundamentalData;
    if (dbFund) {
      fundData = {
        ticker: cleanTicker,
        asOfDate: dbFund.as_of_date,
        marketCap: dbFund.market_cap,
        revenueGrowthYoy: dbFund.revenue_growth,
        earningsGrowthYoy: dbFund.eps_growth,
        operatingMargin: dbFund.operating_margin,
        freeCashFlowMargin: dbFund.fcf_margin,
        trailingPe: dbFund.trailing_pe,
        forwardPe: dbFund.forward_pe,
        psRatio: dbFund.ps_ratio,
        pegRatio: dbFund.peg_ratio,
        sector: dbAsset?.sector,
        industry: dbAsset?.industry,
        quoteType: dbAsset?.asset_type === 'etf' ? 'ETF' : 'EQUITY',
      };
    } else {
      // Yahoo provides no real fundamentals (seed baseline); record honest source.
      const usedFallback = this.provider.name === 'yahoo';
      fundData = await this.provider.getFundamentals(cleanTicker);
      if (fundData) {
        await fundamentalsRepository.save(fundData, usedFallback ? 'seed' : this.provider.name);
      }
    }

    const normalized: NormalizedMarketData = {
      ticker: cleanTicker,
      quote: liveQuote,
      bars: dbBars,
      fundamentals: fundData,
      benchmarkBars,
      fetchedAt: new Date().toISOString(),
      source: this.provider.name,
    };

    const tech = calculateTechnicalIndicators(normalized.bars);
    const mom = calculateMomentumIndicators(normalized.bars, benchmarkBars);
    const fundInd = extractFundamentalIndicators(normalized.fundamentals, isEtfHint);

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
      revenueGrowthYoy: fundInd.revenueGrowthYoy,
      earningsGrowthYoy: fundInd.earningsGrowthYoy,
      operatingMargin: fundInd.operatingMargin,
      freeCashFlowMargin: fundInd.freeCashFlowMargin,
      marketCapBillions: fundInd.marketCapBillions,
      trailingPe: fundInd.trailingPe,
      forwardPe: fundInd.forwardPe,
      psRatio: fundInd.psRatio,
      pegRatio: fundInd.pegRatio,
    };

    // Save indicator snapshot to DB
    await indicatorRepository.save(cleanTicker, indicators, normalized.quote.timestamp || new Date().toISOString().split('T')[0]);

    const riskInputs: RawRiskInputs = {
      beta: mom.beta,
      volatility20dAnnualized: mom.volatility20dAnnualized,
      maxDrawdown52w: tech.drawdownFromHigh,
      rsi14: tech.rsi14,
      priceBelowMa200: tech.priceBelowMa200,
      missingDataPoints: normalized.bars.length < 200 ? 1 : 0,
    };

    const isEtf = normalized.fundamentals.quoteType === 'ETF' || isEtfHint;

    // 시장(OHLCV) 폴백 판정: provider 자체가 seed로 폴백했거나, DB에 저장된
    // bars 중 seed 출처가 있으면(과거에 seed로 저장된 경우) 이 종목은 시장
    // 데이터가 seed다. Backtest HistoricalDataProvider와 동일한 판정 기준을
    // Live에도 적용한다(리뷰 P0-2).
    const hasSeedBars = dbBars.length > 0 && dbBars.some((b) => b.source === 'seed');
    const providerFellBack =
      this.provider.name === 'yahoo' && !!this.provider.getHadFallback?.();
    const isFallback = providerFellBack || hasSeedBars;

    // 폴백 발생 시 실제 출처를 정직하게 기록 (오표기 방지)
    if (isFallback) {
      normalized.source = 'seed';
    }

    // 독립 출처 추적: 시장(OHLCV)과 펀더멘털은 서로 다른 출처일 수 있다.
    const marketDataSource = isFallback ? 'seed' : this.provider.name;
    // P0-1: DB에 저장된 source를 우선 보존한다. DB 레코드에 source='seed'로
    // 저장됐다면 'database'가 아닌 'seed'로 기록해야 실제 출처가 정직하게 남는다.
    const fundamentalDataSource =
      dbFund?.source ||
      (this.provider.name === 'yahoo' ? 'seed' : this.provider.name);

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
      isFallback,
      marketDataSource,
      fundamentalDataSource,
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
              isFallback: true,
              marketDataSource: 'seed',
              fundamentalDataSource: 'seed',
            } as ProcessedAssetData;
          }
        })
      );
      results.push(...chunkResults);
    }
    return results;
  }
}
