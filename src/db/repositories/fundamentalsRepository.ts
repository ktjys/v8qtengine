import { dbClient } from '../supabaseClient';
import { FundamentalData } from '../../data/providers/types';
import { assetRepository } from './assetRepository';

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
    const asOfDate = data.asOfDate || new Date().toISOString().split('T')[0];
    const key = `${clean}_${asOfDate}`;
    const now = new Date().toISOString();

    const record: FundamentalsRecord = {
      ticker: clean,
      as_of_date: asOfDate,
      revenue_growth: data.revenueGrowthYoy,
      eps_growth: data.earningsGrowthYoy,
      operating_margin: data.operatingMargin,
      fcf_margin: data.freeCashFlowMargin,
      market_cap: data.marketCap || 0,
      trailing_pe: data.trailingPe,
      forward_pe: data.forwardPe,
      ps_ratio: data.psRatio,
      peg_ratio: data.pegRatio,
      source,
      fetched_at: now,
    };

    dbClient.fundamentals.set(key, record);

    if (dbClient.isTableAvailable('fundamentals') && dbClient.supabase) {
      try {
        await assetRepository.upsert({
          ticker: clean,
          name: clean,
          asset_type: data.quoteType === 'ETF' ? 'etf' : 'equity',
          exchange: 'US',
          sector: data.sector,
          industry: data.industry,
          currency: 'USD',
          is_active: true,
          created_at: now,
          updated_at: now,
        });

        const payload = {
          ticker: clean,
          as_of_date: asOfDate,
          revenue_growth: data.revenueGrowthYoy,
          eps_growth: data.earningsGrowthYoy,
          operating_margin: data.operatingMargin,
          fcf_margin: data.freeCashFlowMargin,
          market_cap: data.marketCap || 0,
          trailing_pe: data.trailingPe,
          forward_pe: data.forwardPe,
          ps_ratio: data.psRatio,
          peg_ratio: data.pegRatio,
          source,
          fetched_at: now,
        };

        const { error } = await dbClient.supabase
          .from('fundamentals')
          .upsert(payload, { onConflict: 'ticker,as_of_date' });

        if (error) {
          dbClient.handleDbError('fundamentals', 'save', error);
        }
      } catch (err) {
        dbClient.handleDbError('fundamentals', 'save', err);
      }
    }
  }

  async getLatest(ticker: string): Promise<FundamentalsRecord | null> {
    const clean = ticker.toUpperCase().trim();

    if (dbClient.isTableAvailable('fundamentals') && dbClient.supabase) {
      try {
        const { data, error } = await dbClient.supabase
          .from('fundamentals')
          .select('*')
          .eq('ticker', clean)
          .order('as_of_date', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          dbClient.handleDbError('fundamentals', 'getLatest', error);
        } else if (data) {
          const rec: FundamentalsRecord = {
            ticker: data.ticker,
            as_of_date: data.as_of_date,
            revenue: data.revenue,
            revenue_growth: data.revenue_growth,
            eps: data.eps,
            eps_growth: data.eps_growth,
            operating_margin: data.operating_margin,
            free_cash_flow: data.free_cash_flow,
            fcf_margin: data.fcf_margin,
            market_cap: Number(data.market_cap),
            trailing_pe: data.trailing_pe,
            forward_pe: data.forward_pe,
            ps_ratio: data.ps_ratio,
            peg_ratio: data.peg_ratio,
            source: data.source || 'supabase',
            fetched_at: data.fetched_at,
          };
          dbClient.fundamentals.set(`${clean}_${rec.as_of_date}`, rec);
          return rec;
        }
      } catch (err) {
        dbClient.handleDbError('fundamentals', 'getLatest', err);
      }
    }

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

