import { AssetClassification, AssetType, StrategyType } from '../types/v8';

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
  let confidence = 0.85;
  let reason = '';

  // ETF Detection
  if (
    quoteType === 'ETF' ||
    name.includes('ETF') ||
    name.includes('INDEX') ||
    name.includes('ISHARES') ||
    name.includes('VANGUARD') ||
    name.includes('SPDR') ||
    name.includes('INVESCO') ||
    ['VOO', 'SPY', 'IVV', 'QQQ', 'QQQM', 'SCHD', 'SMH', 'JEPI', 'TLT', 'XLE', 'SCHG'].includes(ticker)
  ) {
    asset_type = 'etf';

    if (
      ['VOO', 'SPY', 'IVV', 'VTI', 'VT'].includes(ticker) ||
      name.includes('S&P 500') ||
      name.includes('TOTAL STOCK')
    ) {
      strategy_type = 'broad_market_etf';
      confidence = 0.98;
      reason = '광범위 대표 지수(S&P 500 / Total Market) 추종 패시브 ETF';
    } else if (
      ['QQQ', 'QQQM', 'SCHG', 'VUG', 'IWF'].includes(ticker) ||
      name.includes('NASDAQ') ||
      name.includes('GROWTH')
    ) {
      strategy_type = 'growth_etf';
      confidence = 0.95;
      reason = '대형 성장주 및 나스닥 기반 성장형 지수 추종 ETF';
    } else if (
      ['SCHD', 'VYM', 'DGRO', 'HDV', 'NOBL'].includes(ticker) ||
      name.includes('DIVIDEND') ||
      name.includes('HIGH YIELD')
    ) {
      strategy_type = 'dividend_etf';
      confidence = 0.95;
      reason = '우량 배당성장 및 배당수익률 중점 방어형 ETF';
    } else if (
      ['JEPI', 'JEPQ', 'QYLD', 'XYLD'].includes(ticker) ||
      name.includes('PREMIUM INCOME') ||
      name.includes('COVERED CALL')
    ) {
      strategy_type = 'income_etf';
      confidence = 0.95;
      reason = '커버드콜 및 옵션 인컴 구조의 월지급식 인컴 ETF';
    } else if (
      ['SMH', 'SOXX', 'XLE', 'XLK', 'XLF', 'XLV', 'IBIT'].includes(ticker) ||
      name.includes('SEMICONDUCTOR') ||
      name.includes('ENERGY') ||
      name.includes('TECH')
    ) {
      strategy_type = 'sector_etf';
      confidence = 0.93;
      reason = '특정 산업 섹터(반도체, 에너지, 테크 등) 집중 ETF';
    } else {
      strategy_type = 'other_etf';
      confidence = 0.75;
      reason = '기타 테마/채권/원자재형 ETF';
    }
  } else {
    // Equity Classification
    asset_type = 'equity';

    const isMegacap = marketCap > 500_000_000_000; // $500B+
    const isLargeCap = marketCap > 100_000_000_000; // $100B+
    const isHighGrowth = revGrowth > 0.20; // 20%+ YoY
    const isHighBeta = beta > 1.8;

    if (
      ['OKLO', 'IONQ', 'SOFI', 'COIN', 'RKLB', 'MSTR', 'MARA'].includes(ticker) ||
      (isHighBeta && marketCap < 80_000_000_000) ||
      (revGrowth > 0.4 && marketCap < 40_000_000_000) ||
      beta > 2.2
    ) {
      strategy_type = 'speculative';
      confidence = 0.90;
      reason = '높은 베타 및 급격한 변동성, 미래 기대감 중심의 투기/초기성장주';
    } else if (
      ['NVDA', 'AMZN', 'AVGO', 'TSLA', 'AMD', 'META', 'LLY', 'PLTR', 'CRWD'].includes(ticker) ||
      (isLargeCap && isHighGrowth)
    ) {
      strategy_type = 'established_growth';
      confidence = 0.95;
      reason = '실적 기반 고성장세와 강력한 시장 지배력을 확보한 대형 성장주';
    } else if (
      ['MSFT', 'AAPL', 'GOOGL', 'BRK-B', 'JNJ', 'PG', 'UNH', 'V'].includes(ticker) ||
      (isMegacap && beta <= 1.2)
    ) {
      strategy_type = 'quality';
      confidence = 0.96;
      reason = '안정적 현금흐름, 높은 영업이익률, 낮은 변동성의 최고 우량주';
    } else {
      strategy_type = 'general_equity';
      confidence = 0.70;
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
