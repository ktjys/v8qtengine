import { dbClient } from '../supabaseClient';
import { FundamentalData } from '../../data/providers/types';
import { assetRepository } from './assetRepository';

export interface FundamentalsRecord {
  ticker: string;
  as_of_date: string;
  published_at?: string;
  period_end_date?: string;
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
      published_at: asOfDate,
      period_end_date: asOfDate,
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
          published_at: asOfDate,
          period_end_date: asOfDate,
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

  /**
   * Preload all fundamentals in 1 single Supabase query to prevent individual subrequests during scan
   */
  async preloadAll(): Promise<void> {
    if (dbClient.isTableAvailable('fundamentals') && dbClient.supabase) {
      try {
        const { data, error } = await dbClient.supabase
          .from('fundamentals')
          .select('*')
          .order('as_of_date', { ascending: false });

        if (!error && Array.isArray(data)) {
          for (const row of data) {
            const rec = toRecord(row);
            const key = `${rec.ticker}_${rec.as_of_date}`;
            if (!dbClient.fundamentals.has(key)) {
              dbClient.fundamentals.set(key, rec);
            }
          }
        }
      } catch (err) {
        console.warn('[FundamentalsRepository] preloadAll exception:', err);
      }
    }
  }

  async getLatest(ticker: string): Promise<FundamentalsRecord | null> {
    const clean = ticker.toUpperCase().trim();

    // 1. Check in-memory cache first
    const matching: FundamentalsRecord[] = [];
    for (const [k, v] of dbClient.fundamentals.entries()) {
      if (k.startsWith(`${clean}_`)) {
        matching.push(v);
      }
    }
    if (matching.length > 0) {
      matching.sort((a, b) => b.as_of_date.localeCompare(a.as_of_date));
      return matching[0];
    }

    // 2. Query Supabase if not cached
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
          const rec = toRecord(data);
          dbClient.fundamentals.set(`${clean}_${rec.as_of_date}`, rec);
          return rec;
        }
      } catch (err) {
        dbClient.handleDbError('fundamentals', 'getLatest', err);
      }
    }

    return null;
  }

  /**
   * Point-in-Time 조회: 평가 기준일(evaluationDate) 이전에 공시된(published_at <= evaluationDate)
   * 가장 최신 fundamentals 를 반환한다.
   * 과거 스코어 히스토리/백테스트에서 미래 재무 데이터 참조(look-ahead bias)를 방지한다.
   */
  async getAsOf(ticker: string, evaluationDate: string): Promise<FundamentalsRecord | null> {
    const clean = ticker.toUpperCase().trim();
    const asOfDate = evaluationDate.split('T')[0];

    if (dbClient.isTableAvailable('fundamentals') && dbClient.supabase) {
      try {
        // First try filtering by published_at if populated, otherwise as_of_date
        const { data, error } = await dbClient.supabase
          .from('fundamentals')
          .select('*')
          .eq('ticker', clean)
          .lte('as_of_date', asOfDate)
          .order('as_of_date', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          dbClient.handleDbError('fundamentals', 'getAsOf', error);
        } else if (data) {
          return toRecord(data);
        }
      } catch (err) {
        dbClient.handleDbError('fundamentals', 'getAsOf', err);
      }
    }

    const matching: FundamentalsRecord[] = [];
    for (const [k, v] of dbClient.fundamentals.entries()) {
      const pubDate = v.published_at || v.as_of_date;
      if (k.startsWith(`${clean}_`) && pubDate <= asOfDate) {
        matching.push(v);
      }
    }
    if (matching.length === 0) return null;
    matching.sort((a, b) => (b.published_at || b.as_of_date).localeCompare(a.published_at || a.as_of_date));
    return matching[0];
  }

  /** PIT 히스토리 전체 조회 (모든 published_at/as_of_date <= evaluationDate) */
  async getHistoryAsOf(ticker: string, evaluationDate?: string): Promise<FundamentalsRecord[]> {
    const clean = ticker.toUpperCase().trim();
    const asOfDate = evaluationDate ? evaluationDate.split('T')[0] : undefined;

    if (dbClient.isTableAvailable('fundamentals') && dbClient.supabase) {
      try {
        let q = dbClient.supabase
          .from('fundamentals')
          .select('*')
          .eq('ticker', clean);
        if (asOfDate) q = q.lte('as_of_date', asOfDate);
        const { data, error } = await q.order('as_of_date', { ascending: true });
        if (error) {
          dbClient.handleDbError('fundamentals', 'getHistoryAsOf', error);
        } else if (data && data.length > 0) {
          return data.map(toRecord);
        }
      } catch (err) {
        dbClient.handleDbError('fundamentals', 'getHistoryAsOf', err);
      }
    }

    const result: FundamentalsRecord[] = [];
    for (const [k, v] of dbClient.fundamentals.entries()) {
      const pubDate = v.published_at || v.as_of_date;
      if (k.startsWith(`${clean}_`) && (!asOfDate || pubDate <= asOfDate)) {
        result.push(v);
      }
    }
    result.sort((a, b) => (a.published_at || a.as_of_date).localeCompare(b.published_at || b.as_of_date));
    return result;
  }
}

function toRecord(data: any): FundamentalsRecord {
  return {
    ticker: data.ticker,
    as_of_date: data.as_of_date,
    published_at: data.published_at || data.as_of_date,
    period_end_date: data.period_end_date || data.as_of_date,
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
}

export const fundamentalsRepository = new FundamentalsRepository();

