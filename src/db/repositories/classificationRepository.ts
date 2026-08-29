import { AssetClassification } from '../../types/v8';
import { dbClient } from '../supabaseClient';

/**
 * 수동 오버라이드의 Point-in-Time 스냅샷.
 * effective_date 기준으로 과거 시점의 수동 분류를 조회할 수 있게 한다.
 * (FundamentalsRepository의 getAsOf/getHistoryAsOf PIT 패턴과 동일)
 */
export interface ClassificationSnapshot {
  ticker: string;
  effective_date: string;
  asset_type: string;
  strategy_type: string;
  confidence: number;
  reason: string;
}

export class ClassificationRepository {
  /**
   * 수동 오버라이드 저장. effective_date(기준일)와 함께 기록되어
   * 이후 PIT 백테스트에서 그 날짜부터만 적용된다.
   */
  async save(override: AssetClassification): Promise<void> {
    const clean = override.ticker.toUpperCase().trim();
    const effectiveDate =
      override.effective_date || override.classified_at.split('T')[0] || new Date().toISOString().split('T')[0];

    const snapshot: ClassificationSnapshot = {
      ticker: clean,
      effective_date: effectiveDate,
      asset_type: override.asset_type,
      strategy_type: override.strategy_type,
      confidence: override.confidence,
      reason: override.reason,
    };

    // 인메모리: ticker_date 키로 기록 (동일 기준일 재저장 시 덮어씀)
    dbClient.classifications.set(clean, override);
    dbClient.classificationSnapshots.set(`${clean}_${effectiveDate}`, snapshot);

    if (dbClient.isTableAvailable('classification_snapshot') && dbClient.supabase) {
      try {
        const { error } = await dbClient.supabase
          .from('classification_snapshot')
          .upsert({ ...snapshot, updated_at: new Date().toISOString() }, { onConflict: 'ticker,effective_date' });
        if (error) {
          dbClient.handleDbError('classification_snapshot', 'save', error);
        }
      } catch (err) {
        dbClient.handleDbError('classification_snapshot', 'save', err);
      }
    }
  }

  /** 현재 유효한 수동 오버라이드 (PIT 미사용, 최신 스냅샷). */
  getCurrent(ticker: string): AssetClassification | null {
    return dbClient.classifications.get(ticker.toUpperCase().trim()) || null;
  }

  /**
   * Point-in-Time 조회: evaluationDate 이전에 유효해진 가장 최신 수동 오버라이드를 반환.
   * effective_date > evaluationDate인 (미래에 설정된) 오버라이드는 절대 적용하지 않아
   * 백테스트에서 미래 분류 참조(look-ahead bias)를 방지한다. 없으면 null → 자동 분류 사용.
   */
  async getAsOf(ticker: string, evaluationDate: string): Promise<AssetClassification | null> {
    const clean = ticker.toUpperCase().trim();
    const asOfDate = evaluationDate.split('T')[0];

    if (dbClient.isTableAvailable('classification_snapshot') && dbClient.supabase) {
      try {
        const { data, error } = await dbClient.supabase
          .from('classification_snapshot')
          .select('*')
          .eq('ticker', clean)
          .lte('effective_date', asOfDate)
          .order('effective_date', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!error && data) {
          return this.toClassification(data);
        }
      } catch (err) {
        dbClient.handleDbError('classification_snapshot', 'getAsOf', err);
      }
    }

    const matching: ClassificationSnapshot[] = [];
    for (const [k, v] of dbClient.classificationSnapshots.entries()) {
      if (k.startsWith(`${clean}_`) && v.effective_date <= asOfDate) {
        matching.push(v);
      }
    }
    if (matching.length === 0) return null;
    matching.sort((a, b) => b.effective_date.localeCompare(a.effective_date));
    return this.toClassification(matching[0]);
  }

  private toClassification(snap: any): AssetClassification {
    return {
      ticker: snap.ticker,
      asset_type: snap.asset_type,
      strategy_type: snap.strategy_type,
      confidence: snap.confidence ?? 1.0,
      classification_source: 'manual',
      reason: snap.reason || 'Manual Override',
      classified_at: `${snap.effective_date}T00:00:00.000Z`,
      updated_at: snap.updated_at || `${snap.effective_date}T00:00:00.000Z`,
      effective_date: snap.effective_date,
    };
  }
}

export const classificationRepository = new ClassificationRepository();
