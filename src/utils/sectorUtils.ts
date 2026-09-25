import { FullTickerEvaluation } from '../types/v8';
import { getStockDisplayInfo } from './marketUtils';

export interface SectorItem {
  ticker: string;
  name: string;
  displayName: string;
  subCode: string;
  isKorean: boolean;
  sector: string;
  industry: string;
  price: number;
  change1d: number;
  marketCapBillions: number;
  opportunityScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  decision: string;
  actionable: boolean;
  rsi: number;
  return1M: number;
  strategyType: string;
  rawEvaluation: FullTickerEvaluation;
}

export interface SectorGroup {
  sector: string;
  items: SectorItem[];
  avgChange1d: number;
  totalMarketCap: number;
  topPerformer: SectorItem;
  worstPerformer: SectorItem;
  opportunityCount: number;
}

/**
 * 트리맵 타일 공간에 맞춰 간결한 종목명(한글명/영문명)을 반환하는 헬퍼
 * 예: "엔비디아 (NVIDIA)" -> "엔비디아", "삼성전자" -> "삼성전자", "Apple Inc." -> "Apple"
 */
export function getShortStockDisplayName(primaryName: string, fallbackTicker: string): string {
  if (!primaryName) return fallbackTicker;
  const match = primaryName.match(/^([^(]+)\s*\((.+)\)$/);
  if (match) {
    return match[1].trim();
  }
  // 영문 주식회사 접미사 정리
  return primaryName.replace(/,\s*(Inc\.|Corp\.|Corporation|Ltd\.|Co\.,\s*Ltd\.|Holdings)$/i, '').trim();
}

export const KNOWN_TICKER_SECTOR_MAP: Record<
  string,
  { sector: string; industry: string; fallbackMarketCap: number }
> = {
  // 미국 주요 종목
  NVDA: { sector: 'Semiconductors', industry: 'AI & GPU Semiconductors', fallbackMarketCap: 3100 },
  AMD: { sector: 'Semiconductors', industry: 'Fabless CPU & GPU', fallbackMarketCap: 250 },
  SMH: { sector: 'Semiconductors', industry: 'VanEck Semiconductor ETF', fallbackMarketCap: 25 },
  AAPL: { sector: 'Technology', industry: 'Consumer Electronics & Ecosystem', fallbackMarketCap: 3400 },
  MSFT: { sector: 'Technology', industry: 'Systems & Cloud Infrastructure', fallbackMarketCap: 3150 },
  PLTR: { sector: 'Technology', industry: 'Enterprise AI & Big Data Platforms', fallbackMarketCap: 75 },
  ORCL: { sector: 'Technology', industry: 'Database & Enterprise Cloud', fallbackMarketCap: 380 },
  GOOGL: { sector: 'Communication Services', industry: 'Search & Generative AI', fallbackMarketCap: 2050 },
  META: { sector: 'Communication Services', industry: 'Social Media & Metaverse', fallbackMarketCap: 1350 },
  NFLX: { sector: 'Communication Services', industry: 'Streaming Entertainment', fallbackMarketCap: 290 },
  AMZN: { sector: 'Consumer Discretionary', industry: 'E-commerce & AWS Cloud', fallbackMarketCap: 1950 },
  TSLA: { sector: 'Consumer Discretionary', industry: 'EV & Autonomous Mobility', fallbackMarketCap: 780 },
  V: { sector: 'Financial Services', industry: 'Global Payment Processing', fallbackMarketCap: 560 },
  HOOD: { sector: 'Financial Services', industry: 'Digital Brokerage & Crypto', fallbackMarketCap: 22 },
  JNJ: { sector: 'Healthcare', industry: 'Pharmaceuticals & Medical Devices', fallbackMarketCap: 390 },
  OKLO: { sector: 'Energy', industry: 'Advanced Fission Nuclear', fallbackMarketCap: 4 },
  SPY: { sector: 'Broad Market Index ETF', industry: 'S&P 500 Large-Cap Index', fallbackMarketCap: 540 },
  QQQ: { sector: 'Broad Market Index ETF', industry: 'Nasdaq 100 Tech Index', fallbackMarketCap: 280 },
  VOO: { sector: 'Broad Market Index ETF', industry: 'Vanguard S&P 500 ETF', fallbackMarketCap: 500 },
  SCHD: { sector: 'Broad Market Index ETF', industry: 'US Dividend 100 Index', fallbackMarketCap: 58 },
  SPCX: { sector: 'Broad Market Index ETF', industry: 'Active Growth ETF', fallbackMarketCap: 1 },

  // 국내 주요 종목 (KOSPI & KOSDAQ)
  '005930': { sector: 'Semiconductors', industry: '반도체 및 전자 (Semiconductor & Mobile)', fallbackMarketCap: 440 },
  '005930.KS': { sector: 'Semiconductors', industry: '반도체 및 전자 (Semiconductor & Mobile)', fallbackMarketCap: 440 },
  '000660': { sector: 'Semiconductors', industry: 'HBM 및 메모리 반도체 (Memory Semiconductor)', fallbackMarketCap: 140 },
  '000660.KS': { sector: 'Semiconductors', industry: 'HBM 및 메모리 반도체 (Memory Semiconductor)', fallbackMarketCap: 140 },
  '042700': { sector: 'Semiconductors', industry: '반도체 후공정 장비 (HBM Packaging Equipment)', fallbackMarketCap: 14 },
  '042700.KS': { sector: 'Semiconductors', industry: '반도체 후공정 장비 (HBM Packaging Equipment)', fallbackMarketCap: 14 },
  '373220': { sector: 'Technology', industry: '2차전지 배터리 (EV Battery & Energy Storage)', fallbackMarketCap: 90 },
  '373220.KS': { sector: 'Technology', industry: '2차전지 배터리 (EV Battery & Energy Storage)', fallbackMarketCap: 90 },
  '247540': { sector: 'Technology', industry: '2차전지 양극재 소재 (Cathode Materials)', fallbackMarketCap: 18 },
  '247540.KQ': { sector: 'Technology', industry: '2차전지 양극재 소재 (Cathode Materials)', fallbackMarketCap: 18 },
  '207940': { sector: 'Healthcare', industry: '바이오의약품 CDMO (Biologics CDMO)', fallbackMarketCap: 68 },
  '207940.KS': { sector: 'Healthcare', industry: '바이오의약품 CDMO (Biologics CDMO)', fallbackMarketCap: 68 },
  '068270': { sector: 'Healthcare', industry: '바이오시밀러 및 제약 (Biosimilar & Pharma)', fallbackMarketCap: 42 },
  '068270.KS': { sector: 'Healthcare', industry: '바이오시밀러 및 제약 (Biosimilar & Pharma)', fallbackMarketCap: 42 },
  '196170': { sector: 'Healthcare', industry: '바이오 플랫폼 및 항암제 (Bio Platform)', fallbackMarketCap: 16 },
  '196170.KQ': { sector: 'Healthcare', industry: '바이오 플랫폼 및 항암제 (Bio Platform)', fallbackMarketCap: 16 },
  '005380': { sector: 'Consumer Discretionary', industry: '완성차 및 하이브리드/전기차 (Automotive)', fallbackMarketCap: 52 },
  '005380.KS': { sector: 'Consumer Discretionary', industry: '완성차 및 하이브리드/전기차 (Automotive)', fallbackMarketCap: 52 },
  '000270': { sector: 'Consumer Discretionary', industry: '완성차 및 PBV (Automotive)', fallbackMarketCap: 40 },
  '000270.KS': { sector: 'Consumer Discretionary', industry: '완성차 및 PBV (Automotive)', fallbackMarketCap: 40 },
  '035420': { sector: 'Communication Services', industry: '인터넷 검색 및 AI 클라우드 (Internet Platforms)', fallbackMarketCap: 32 },
  '035420.KS': { sector: 'Communication Services', industry: '인터넷 검색 및 AI 클라우드 (Internet Platforms)', fallbackMarketCap: 32 },
  '035720': { sector: 'Communication Services', industry: '모바일 메신저 및 플랫폼 (Mobile Platforms)', fallbackMarketCap: 18 },
  '035720.KS': { sector: 'Communication Services', industry: '모바일 메신저 및 플랫폼 (Mobile Platforms)', fallbackMarketCap: 18 },
  '005490': { sector: 'Materials', industry: '철강 및 이차전지소재 (Steel & Materials)', fallbackMarketCap: 30 },
  '005490.KS': { sector: 'Materials', industry: '철강 및 이차전지소재 (Steel & Materials)', fallbackMarketCap: 30 },
  '069500': { sector: 'Broad Market Index ETF', industry: 'KOSPI 200 지수 ETF', fallbackMarketCap: 60 },
  '069500.KS': { sector: 'Broad Market Index ETF', industry: 'KOSPI 200 지수 ETF', fallbackMarketCap: 60 },
  '360750': { sector: 'Broad Market Index ETF', industry: 'TIGER 미국 S&P 500 ETF', fallbackMarketCap: 45 },
  '360750.KS': { sector: 'Broad Market Index ETF', industry: 'TIGER 미국 S&P 500 ETF', fallbackMarketCap: 45 },
  '133690': { sector: 'Broad Market Index ETF', industry: 'TIGER 미국 나스닥 100 ETF', fallbackMarketCap: 40 },
  '133690.KS': { sector: 'Broad Market Index ETF', industry: 'TIGER 미국 나스닥 100 ETF', fallbackMarketCap: 40 },
  '458730': { sector: 'Broad Market Index ETF', industry: 'TIGER 미국 배당다우존스 ETF', fallbackMarketCap: 20 },
  '458730.KS': { sector: 'Broad Market Index ETF', industry: 'TIGER 미국 배당다우존스 ETF', fallbackMarketCap: 20 },
};

/**
 * Resolves a unified sector name for any evaluation
 */
export function resolveSector(evaluation: FullTickerEvaluation): { sector: string; industry: string } {
  const ticker = evaluation.ticker?.toUpperCase() || '';
  const known = KNOWN_TICKER_SECTOR_MAP[ticker];
  if (known) {
    return { sector: known.sector, industry: known.industry };
  }

  // Check raw_metadata
  const raw = evaluation.raw_metadata || {};
  const rawIndustry = (raw.industry || '').trim();
  const rawSector = (raw.sector || '').trim();

  if (rawIndustry.toLowerCase().includes('semiconductor')) {
    return { sector: 'Semiconductors', industry: rawIndustry || 'Semiconductor Hardware' };
  }

  if (rawSector) {
    if (rawSector === 'Consumer Cyclical') {
      return { sector: 'Consumer Discretionary', industry: rawIndustry || 'Consumer Cyclical' };
    }
    return { sector: rawSector, industry: rawIndustry || rawSector };
  }

  if (evaluation.classification?.asset_type === 'etf') {
    return { sector: 'Broad Market Index ETF', industry: 'Exchange Traded Fund' };
  }

  return { sector: 'Technology', industry: 'General Technology' };
}

/**
 * Groups evaluations by sector with aggregate metrics
 */
export function groupEvaluationsBySector(evaluations: FullTickerEvaluation[]): SectorGroup[] {
  const map = new Map<string, SectorItem[]>();

  for (const ev of evaluations) {
    const { sector, industry } = resolveSector(ev);
    const known = KNOWN_TICKER_SECTOR_MAP[ev.ticker?.toUpperCase() || ''];

    // Market cap estimation in Billions
    let mktCap = ev.opportunity?.fundamental_details?.marketCapBillions ?? 0;
    if (!mktCap && ev.raw_metadata?.marketCap) {
      mktCap = ev.raw_metadata.marketCap / 1e9;
    }
    if (!mktCap && known) {
      mktCap = known.fallbackMarketCap;
    }
    if (!mktCap || mktCap <= 0) {
      mktCap = ev.classification?.asset_type === 'etf' ? 100 : 10;
    }

    const displayInfo = getStockDisplayInfo(ev.ticker, ev.name);

    const item: SectorItem = {
      ticker: ev.ticker,
      name: displayInfo.primaryName || ev.name || ev.ticker,
      displayName: displayInfo.primaryName,
      subCode: displayInfo.subCode,
      isKorean: displayInfo.isKorean,
      sector,
      industry,
      price: ev.price,
      change1d: ev.change1d ?? 0,
      marketCapBillions: mktCap,
      opportunityScore: ev.opportunity?.opportunity_score ?? 50,
      riskLevel: ev.risk?.risk_level ?? 'MEDIUM',
      decision: ev.decision?.decision ?? 'NEUTRAL',
      actionable: ev.decision?.actionable ?? false,
      rsi: ev.opportunity?.technical_details?.rsi14 ?? 50,
      return1M: (ev.opportunity?.momentum_details?.return1M ?? 0) * 100,
      strategyType: ev.classification?.strategy_type ?? 'general_equity',
      rawEvaluation: ev,
    };

    if (!map.has(sector)) {
      map.set(sector, []);
    }
    map.get(sector)!.push(item);
  }

  const groups: SectorGroup[] = [];

  for (const [sector, items] of map.entries()) {
    items.sort((a, b) => b.change1d - a.change1d);
    const avgChange = items.reduce((acc, curr) => acc + curr.change1d, 0) / (items.length || 1);
    const totalMktCap = items.reduce((acc, curr) => acc + curr.marketCapBillions, 0);
    const oppCount = items.filter(
      (i) => i.decision === 'STRONG_OPPORTUNITY' || i.decision === 'OPPORTUNITY'
    ).length;

    groups.push({
      sector,
      items,
      avgChange1d: Math.round(avgChange * 100) / 100,
      totalMarketCap: Math.round(totalMktCap * 10) / 10,
      topPerformer: items[0],
      worstPerformer: items[items.length - 1],
      opportunityCount: oppCount,
    });
  }

  // Sort sectors by total market cap descending
  groups.sort((a, b) => b.totalMarketCap - a.totalMarketCap);

  return groups;
}
