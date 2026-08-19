import { dbClient } from '../supabaseClient';
import { FundamentalData } from '../../data/providers/types';

export interface FundamentalsRecord {
  ticker: string;
  as_of_date: string;
  revenue?: number;
  revenue_growth?: number;
  eps?: number;
  eps_growth?: number;
  operating_margin?: number;
  free_cash_flow?: number;
  fcf_margin?: number;
  market_cap: number;
  trailing_pe?: number;
  forward_pe?: number;
  ps_ratio?: number;
  peg_ratio?: number;
  source: string;
  fetched_at: string;
}

export class FundamentalsRepository {
  async save(data: FundamentalData, source = 'yahoo'): Promise<void> {
    const clean = data.ticker.toUpperCase().trim();
    const key = `${clean}_${data.asOfDate}`;
    dbClient.fundamentals.set(key, {
      ticker: clean,
      as_of_date: data.asOfDate,
      revenue_growth: data.revenueGrowthYoy,
      eps_growth: data.earningsGrowthYoy,
      operating_margin: data.operatingMargin,
      fcf_margin: data.freeCashFlowMargin,
      market_cap: data.marketCap,
      trailing_pe: data.trailingPe,
      forward_pe: data.forwardPe,
      ps_ratio: data.psRatio,
      peg_ratio: data.pegRatio,
      source,
      fetched_at: new Date().toISOString(),
    });
  }

  async getLatest(ticker: string): Promise<FundamentalsRecord | null> {
    const clean = ticker.toUpperCase().trim();
    const matching: FundamentalsRecord[] = [];
    for (const [k, v] of dbClient.fundamentals.entries()) {
      if (k.startsWith(`${clean}_`)) {
        matching.push(v);
      }
    }
    if (matching.length === 0) return null;
    matching.sort((a, b) => b.as_of_date.localeCompare(a.as_of_date));
    return matching[0];
  }
}

export const fundamentalsRepository = new FundamentalsRepository();
