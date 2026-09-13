import { FullTickerEvaluation } from '../types/v8';

export interface SectorItem {
  ticker: string;
  name: string;
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

export const KNOWN_TICKER_SECTOR_MAP: Record<
  string,
  { sector: string; industry: string; fallbackMarketCap: number }
> = {
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

    const item: SectorItem = {
      ticker: ev.ticker,
      name: ev.name || ev.ticker,
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
