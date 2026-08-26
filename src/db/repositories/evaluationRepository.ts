import { dbClient } from '../supabaseClient';
import { FullTickerEvaluation } from '../../types/v8';
import { assetRepository } from './assetRepository';

export class EvaluationRepository {
  async saveAll(evaluations: FullTickerEvaluation[]): Promise<void> {
    if (!evaluations || evaluations.length === 0) return;

    // 1. Update in-memory state
    for (const ev of evaluations) {
      const clean = ev.ticker.toUpperCase().trim();
      dbClient.evaluations.set(clean, ev);
    }

    if (dbClient.isTableAvailable('evaluations') && dbClient.supabase) {
      try {
        // 2. Batch upsert assets
        const assetRows = evaluations.map((ev) => {
          const clean = ev.ticker.toUpperCase().trim();
          return {
            ticker: clean,
            name: ev.name || clean,
            asset_type: ev.classification?.asset_type || 'equity',
            exchange: 'US',
            currency: 'USD',
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
        });

        await dbClient.supabase.from('assets').upsert(assetRows, { onConflict: 'ticker' });

        // 3. Batch insert evaluations
        const evalPayloads = evaluations.map((ev) => {
          const clean = ev.ticker.toUpperCase().trim();
          return {
            ticker: clean,
            evaluation_date: ev.evaluated_at || new Date().toISOString(),
            strategy_type: ev.classification?.strategy_type || 'CORE_MOMENTUM',
            technical_score: ev.opportunity?.sub_scores?.technical_score ?? 70,
            momentum_score: ev.opportunity?.sub_scores?.momentum_score ?? 70,
            fundamental_score: ev.opportunity?.sub_scores?.fundamental_score ?? 70,
            valuation_score: ev.opportunity?.sub_scores?.valuation_score ?? 70,
            opportunity_score: ev.opportunity?.opportunity_score ?? 70,
            risk_score: ev.risk?.risk_score ?? 50,
            risk_level: ev.risk?.risk_level ?? 'MEDIUM',
            decision: ev.decision?.decision ?? 'HOLD',
            confidence: ev.decision?.confidence ?? 0.8,
            reason_json: {
              name: ev.name,
              price: ev.price,
              change1d: ev.change1d,
              classification: ev.classification,
              opportunity: ev.opportunity,
              risk: ev.risk,
              decision: ev.decision,
              data_quality: ev.data_quality,
            },
          };
        });

        const { error } = await dbClient.supabase.from('evaluations').insert(evalPayloads);
        if (error) {
          dbClient.handleDbError('evaluations', 'saveAll', error);
        }
      } catch (err) {
        dbClient.handleDbError('evaluations', 'saveAll', err);
      }
    }
  }

  async getAll(): Promise<FullTickerEvaluation[]> {
    if (dbClient.isTableAvailable('evaluations') && dbClient.supabase) {
      try {
        const { data, error } = await dbClient.supabase
          .from('evaluations')
          .select('*')
          .order('evaluation_date', { ascending: false });

        if (error) {
          dbClient.handleDbError('evaluations', 'getAll', error);
        } else if (Array.isArray(data)) {
          dbClient.evaluations.clear();
          const map = new Map<string, FullTickerEvaluation>();

          // data is sorted by evaluation_date DESC, so first occurrence of ticker is the newest
          for (const row of data) {
            const ticker = row.ticker?.toUpperCase()?.trim();
            if (!ticker || map.has(ticker)) continue;

            let r = row.reason_json;
            if (typeof r === 'string') {
              try {
                r = JSON.parse(r);
              } catch {
                r = {};
              }
            }
            if (!r || typeof r !== 'object') {
              r = {};
            }

            const assetName = dbClient.assets.get(ticker)?.name;
            const price = Number(r.price || 0);
            const change1d = Number(r.change1d || 0);

            const ev: FullTickerEvaluation = {
              ticker,
              name: r.name || assetName || ticker,
              price,
              change1d,
              evaluated_at: row.evaluation_date || new Date().toISOString(),
              classification: r.classification || {
                ticker,
                asset_type: 'equity',
                strategy_type: row.strategy_type || 'CORE_MOMENTUM',
                confidence: 1.0,
                classification_source: 'rule_based',
                reason: 'Supabase DB 로드',
                classified_at: row.evaluation_date || new Date().toISOString(),
                updated_at: row.evaluation_date || new Date().toISOString(),
              },
              opportunity: r.opportunity || {
                opportunity_score: Number(row.opportunity_score ?? 70),
                technical_score: Number(row.technical_score ?? 70),
                momentum_score: Number(row.momentum_score ?? 70),
                fundamental_score: Number(row.fundamental_score ?? 70),
                valuation_score: Number(row.valuation_score ?? 70),
                components: {
                  weights: { technical: 0.35, momentum: 0.35, fundamental: 0.15, valuation: 0.15 },
                  breakdown: {
                    technical: Number(row.technical_score ?? 70),
                    momentum: Number(row.momentum_score ?? 70),
                    fundamental: Number(row.fundamental_score ?? 70),
                    valuation: Number(row.valuation_score ?? 70),
                  },
                },
                summary_reason: `DB 레코드 로드 (기회 점수: ${row.opportunity_score}점)`,
              },
              risk: r.risk || {
                risk_score: Number(row.risk_score ?? 50),
                risk_level: row.risk_level || 'MEDIUM',
                reasons: [],
                deductions: [],
              },
              decision: r.decision || {
                decision: row.decision || 'HOLD',
                confidence: Number(row.confidence ?? 0.8),
                actionable: (row.decision || '').includes('OPPORTUNITY'),
                strategy_type: row.strategy_type || 'CORE_MOMENTUM',
                reasons: [],
                summary: `DB 레코드 로드 (결정: ${row.decision})`,
              },
              signal_generated: (row.decision || '').includes('OPPORTUNITY'),
              data_quality: r.data_quality || { isFresh: true, isComplete: true, qualityScore: 100, warnings: [] },
            };

            map.set(ticker, ev);
            dbClient.evaluations.set(ticker, ev);
          }

          return Array.from(map.values());
        }
      } catch (err) {
        dbClient.handleDbError('evaluations', 'getAll', err);
      }
    }

    return Array.from(dbClient.evaluations.values());
  }

  async findByTicker(ticker: string): Promise<FullTickerEvaluation | null> {
    const clean = ticker.toUpperCase().trim();
    const cached = dbClient.evaluations.get(clean);
    if (cached) return cached;

    const all = await this.getAll();
    return all.find((e) => e.ticker === clean) || null;
  }
}

export const evaluationRepository = new EvaluationRepository();

