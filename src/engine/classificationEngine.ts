import { AssetClassification, AssetType, StrategyType } from '../types/v8';
import { CLASSIFICATION_CONFIG } from '../config/engineConstants';

export interface RawYahooMetadata {
  quoteType?: string; // 'ETF' | 'EQUITY' | 'MUTUALFUND'
  shortName?: string;
  longName?: string;
  sector?: string;
  industry?: string;
  marketCap?: number;
  revenueGrowth?: number;
  earningsGrowth?: number;
  beta?: number;
  trailingPE?: number;
  forwardPE?: number;
  dividendYield?: number;
  description?: string;
}

const BROAD_MARKET_ETF_TICKERS = ['VOO', 'SPY', 'IVV', 'VTI', 'VT'] as const;
const GROWTH_ETF_TICKERS = ['QQQ', 'QQQM', 'SCHG', 'VUG', 'IWF'] as const;
const DIVIDEND_ETF_TICKERS = ['SCHD', 'VYM', 'DGRO', 'HDV', 'NOBL'] as const;
const INCOME_ETF_TICKERS = ['JEPI', 'JEPQ', 'QYLD', 'XYLD'] as const;
const SECTOR_ETF_TICKERS = ['SMH', 'SOXX', 'XLE', 'XLK', 'XLF', 'XLV', 'IBIT'] as const;
const ETF_DETECTION_TICKERS = ['VOO', 'SPY', 'IVV', 'QQQ', 'QQQM', 'SCHD', 'SMH', 'JEPI', 'TLT', 'XLE', 'SCHG'] as const;

const SPECULATIVE_TICKERS = ['OKLO', 'IONQ', 'SOFI', 'COIN', 'RKLB', 'MSTR', 'MARA'] as const;
const ESTABLISHED_GROWTH_TICKERS = ['NVDA', 'AMZN', 'AVGO', 'TSLA', 'AMD', 'META', 'LLY', 'PLTR', 'CRWD'] as const;
const QUALITY_TICKERS = ['MSFT', 'AAPL', 'GOOGL', 'BRK-B', 'JNJ', 'PG', 'UNH', 'V'] as const;

export function classifyAsset(
  ticker: string,
  raw: RawYahooMetadata,
  existingClassification?: AssetClassification
): AssetClassification {
  const now = new Date().toISOString();

  // 1. If manual override exists, preserve it!
  if (
    existingClassification &&
    existingClassification.classification_source === 'manual'
  ) {
    return {
      ...existingClassification,
      updated_at: now,
    };
  }

  const quoteType = (raw.quoteType || '').toUpperCase();
  const name = (raw.longName || raw.shortName || ticker).toUpperCase();
  const sector = (raw.sector || '').toUpperCase();
  const industry = (raw.industry || '').toUpperCase();
  const beta = raw.beta ?? 1.0;
  const marketCap = raw.marketCap ?? 0;
  const revGrowth = raw.revenueGrowth ?? 0;

  let asset_type: AssetType = 'equity';
  let strategy_type: StrategyType = 'general_equity';
  let confidence = CLASSIFICATION_CONFIG.CONFIDENCE_DEFAULT;
  let reason = '';

  // ETF Detection
  const isEtfByType = quoteType === 'ETF';
  const isEtfByName = name.includes('ETF') || name.includes('INDEX');
  const isEtfByProvider = name.includes('ISHARES') || name.includes('VANGUARD') || name.includes('SPDR') || name.includes('INVESCO');
  const isEtfByTicker = ETF_DETECTION_TICKERS.includes(ticker as any);

  if (isEtfByType || isEtfByName || isEtfByProvider || isEtfByTicker) {
    asset_type = 'etf';

    const isBroadMarket = BROAD_MARKET_ETF_TICKERS.includes(ticker as any) ||
      name.includes('S&P 500') || name.includes('TOTAL STOCK');
    const isGrowthEtf = GROWTH_ETF_TICKERS.includes(ticker as any) ||
      name.includes('NASDAQ') || name.includes('GROWTH');
    const isDividendEtf = DIVIDEND_ETF_TICKERS.includes(ticker as any) ||
      name.includes('DIVIDEND') || name.includes('HIGH YIELD');
    const isIncomeEtf = INCOME_ETF_TICKERS.includes(ticker as any) ||
      name.includes('PREMIUM INCOME') || name.includes('COVERED CALL');
    const isSectorEtf = SECTOR_ETF_TICKERS.includes(ticker as any) ||
      name.includes('SEMICONDUCTOR') || name.includes('ENERGY') || name.includes('TECH');

    if (isBroadMarket) {
      strategy_type = 'broad_market_etf';
      confidence = CLASSIFICATION_CONFIG.CONFIDENCE_BROAD_MARKET_ETF;
      reason = '광범위 대표 지수(S&P 500 / Total Market) 추종 패시브 ETF';
    } else if (isGrowthEtf) {
      strategy_type = 'growth_etf';
      confidence = CLASSIFICATION_CONFIG.CONFIDENCE_GROWTH_ETF;
      reason = '대형 성장주 및 나스닥 기반 성장형 지수 추종 ETF';
    } else if (isDividendEtf) {
      strategy_type = 'dividend_etf';
      confidence = CLASSIFICATION_CONFIG.CONFIDENCE_DIVIDEND_ETF;
      reason = '우량 배당성장 및 배당수익률 중점 방어형 ETF';
    } else if (isIncomeEtf) {
      strategy_type = 'income_etf';
      confidence = CLASSIFICATION_CONFIG.CONFIDENCE_INCOME_ETF;
      reason = '커버드콜 및 옵션 인컴 구조의 월지급식 인컴 ETF';
    } else if (isSectorEtf) {
      strategy_type = 'sector_etf';
      confidence = CLASSIFICATION_CONFIG.CONFIDENCE_SECTOR_ETF;
      reason = '특정 산업 섹터(반도체, 에너지, 테크 등) 집중 ETF';
    } else {
      strategy_type = 'other_etf';
      confidence = CLASSIFICATION_CONFIG.CONFIDENCE_OTHER_ETF;
      reason = '기타 테마/채권/원자재형 ETF';
    }
  } else {
    // Equity Classification
    asset_type = 'equity';

    const isMegacap = marketCap > CLASSIFICATION_CONFIG.MEGACAP_THRESHOLD;
    const isLargeCap = marketCap > CLASSIFICATION_CONFIG.LARGE_CAP_THRESHOLD;
    const isHighGrowth = revGrowth > CLASSIFICATION_CONFIG.HIGH_GROWTH_REVENUE_YOY;
    const isHighBeta = beta > CLASSIFICATION_CONFIG.HIGH_BETA_THRESHOLD;

    const isSpeculativeTicker = SPECULATIVE_TICKERS.includes(ticker as any);
    const isSpeculativeByMetrics =
      (isHighBeta && marketCap < CLASSIFICATION_CONFIG.SPECULATIVE_MCAP_HIGH_BETA) ||
      (revGrowth > CLASSIFICATION_CONFIG.SPECULATIVE_GROWTH_REVENUE_YOY && marketCap < CLASSIFICATION_CONFIG.SPECULATIVE_MCAP_HIGH_GROWTH) ||
      beta > CLASSIFICATION_CONFIG.SPECULATIVE_BETA_THRESHOLD;

    if (isSpeculativeTicker || isSpeculativeByMetrics) {
      strategy_type = 'speculative';
      confidence = CLASSIFICATION_CONFIG.CONFIDENCE_SPECULATIVE;
      reason = '높은 베타 및 급격한 변동성, 미래 기대감 중심의 투기/초기성장주';
    } else if (
      ESTABLISHED_GROWTH_TICKERS.includes(ticker as any) ||
      (isLargeCap && isHighGrowth)
    ) {
      strategy_type = 'established_growth';
      confidence = CLASSIFICATION_CONFIG.CONFIDENCE_ESTABLISHED_GROWTH;
      reason = '실적 기반 고성장세와 강력한 시장 지배력을 확보한 대형 성장주';
    } else if (
      QUALITY_TICKERS.includes(ticker as any) ||
      (isMegacap && beta <= CLASSIFICATION_CONFIG.QUALITY_BETA_MAX)
    ) {
      strategy_type = 'quality';
      confidence = CLASSIFICATION_CONFIG.CONFIDENCE_QUALITY;
      reason = '안정적 현금흐름, 높은 영업이익률, 낮은 변동성의 최고 우량주';
    } else {
      strategy_type = 'general_equity';
      confidence = CLASSIFICATION_CONFIG.CONFIDENCE_GENERAL_EQUITY;
      reason = '일반 개별 보통주 (기본 가중치 및 보수적 폴백 적용)';
    }
  }

  return {
    ticker,
    asset_type,
    strategy_type,
    confidence,
    classification_source: 'auto',
    reason,
    classified_at: existingClassification?.classified_at || now,
    updated_at: now,
  };
}
