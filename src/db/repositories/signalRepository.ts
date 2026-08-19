import { dbClient } from '../supabaseClient';
import { SignalSnapshot, SignalStatus } from '../../types/v8';

export class SignalRepository {
  async getAll(version?: 'V8.0' | 'V7.0'): Promise<SignalSnapshot[]> {
    if (dbClient.supabase) {
      try {
        let query = dbClient.supabase.from('signals').select('*, signal_outcomes(*)');
        if (version) {
          query = query.eq('score_version', version);
        }
        const { data, error } = await query.order('signal_date', { ascending: false });

        if (!error && data && data.length > 0) {
          const mapped: SignalSnapshot[] = data.map((row: any) => {
            const outcome = row.signal_outcomes?.[0] || {};
            return {
              id: row.id,
              ticker: row.ticker,
              name: row.reason_json?.name || row.ticker,
              asset_type: row.reason_json?.asset_type || 'equity',
              signal_date: row.signal_date,
              signal_price: Number(row.entry_price),
              score_version: row.score_version as 'V8.0' | 'V7.0',
              strategy_type: row.strategy_type,
              opportunity_score: row.opportunity_score,
              risk_score: row.risk_score,
              risk_level: row.risk_level,
              decision: row.decision,
              signal_confidence: Number(row.confidence ?? 0.8),
              classification_confidence: Number(row.reason_json?.classification_confidence ?? 1.0),
              technical_score: row.technical_score,
              momentum_score: row.momentum_score,
              fundamental_score: row.fundamental_score ?? null,
              valuation_score: row.valuation_score ?? null,
              rsi: Number(row.reason_json?.rsi ?? 50),
              drawdown: Number(row.reason_json?.drawdown ?? 0),
              components: {
                weights: row.reason_json?.weights || { technical: 0.3, momentum: 0.3, fundamental: 0.25, valuation: 0.15 },
                risk_reasons: row.reason_json?.risk_reasons || [],
                decision_reason: row.reason_json?.decision_reason || '',
              },
              status: (row.status as SignalStatus) || 'ACTIVE',
              return_1d: outcome.return_1d ? Number(outcome.return_1d) : undefined,
              return_5d: outcome.return_5d ? Number(outcome.return_5d) : null,
              return_10d: outcome.return_10d ? Number(outcome.return_10d) : null,
              return_20d: outcome.return_20d ? Number(outcome.return_20d) : null,
              current_return: outcome.return_20d ? Number(outcome.return_20d) : null,
              max_gain: outcome.max_gain ? Number(outcome.max_gain) : undefined,
              max_loss: outcome.max_loss ? Number(outcome.max_loss) : undefined,
              is_closed: Boolean(outcome.closed_at),
            };
          });

          // Sync with cache
          mapped.forEach((s) => dbClient.signals.set(s.id, s));
          return mapped;
        }
      } catch (err) {
        console.warn('[SignalRepository] Supabase getAll error, fallback to local cache:', err);
      }
    }

    const list = Array.from(dbClient.signals.values());
    if (version) {
      return list.filter((s) => s.score_version === version);
    }
    return list.sort((a, b) => b.signal_date.localeCompare(a.signal_date));
  }

  async save(signal: SignalSnapshot): Promise<SignalSnapshot> {
    if (dbClient.supabase) {
      try {
        const payload = {
          id: signal.id.startsWith('sig-') ? undefined : signal.id,
          ticker: signal.ticker,
          signal_date: signal.signal_date,
          score_version: signal.score_version,
          strategy_type: signal.strategy_type,
          opportunity_score: signal.opportunity_score,
          risk_score: signal.risk_score,
          risk_level: signal.risk_level,
          decision: signal.decision,
          confidence: signal.signal_confidence,
          entry_price: signal.signal_price,
          technical_score: signal.technical_score,
          momentum_score: signal.momentum_score,
          fundamental_score: signal.fundamental_score,
          valuation_score: signal.valuation_score,
          status: signal.status || 'ACTIVE',
          reason_json: {
            name: signal.name,
            asset_type: signal.asset_type,
            classification_confidence: signal.classification_confidence,
            rsi: signal.rsi,
            drawdown: signal.drawdown,
            weights: signal.components.weights,
            decision_reason: signal.components.decision_reason,
            risk_reasons: signal.components.risk_reasons,
          },
        };

        const { data, error } = await dbClient.supabase
          .from('signals')
          .insert(payload)
          .select('id')
          .maybeSingle();

        if (!error && data?.id) {
          signal.id = data.id;
        }
      } catch (err) {
        console.warn('[SignalRepository] Supabase save error:', err);
      }
    }

    dbClient.signals.set(signal.id, signal);
    return signal;
  }

  async updateOutcome(
    id: string,
    updates: {
      return_1d?: number;
      return_5d?: number;
      return_10d?: number;
      return_20d?: number;
      current_return?: number;
      max_gain?: number;
      max_loss?: number;
      status?: SignalStatus;
      is_closed?: boolean;
    }
  ): Promise<SignalSnapshot | null> {
    const sig = dbClient.signals.get(id);
    if (!sig) return null;

    const updated: SignalSnapshot = {
      ...sig,
      ...updates,
      return_5d: updates.return_5d !== undefined ? updates.return_5d : sig.return_5d,
      return_10d: updates.return_10d !== undefined ? updates.return_10d : sig.return_10d,
      return_20d: updates.return_20d !== undefined ? updates.return_20d : sig.return_20d,
      current_return: updates.current_return !== undefined ? updates.current_return : sig.current_return,
    };

    if (dbClient.supabase) {
      try {
        if (updates.status) {
          await dbClient.supabase
            .from('signals')
            .update({ status: updates.status, updated_at: new Date().toISOString() })
            .eq('id', id);
        }

        const outcomePayload = {
          signal_id: id,
          evaluation_date: new Date().toISOString().split('T')[0],
          price: sig.signal_price,
          return_1d: updates.return_1d,
          return_5d: updates.return_5d,
          return_10d: updates.return_10d,
          return_20d: updates.return_20d,
          max_gain: updates.max_gain,
          max_loss: updates.max_loss,
          is_win_20d: updates.return_20d !== undefined ? updates.return_20d > 0 : undefined,
          closed_at: updates.is_closed ? new Date().toISOString() : null,
        };

        await dbClient.supabase
          .from('signal_outcomes')
          .upsert(outcomePayload, { onConflict: 'signal_id' });
      } catch (err) {
        console.warn(`[SignalRepository] Supabase updateOutcome error for ${id}:`, err);
      }
    }

    dbClient.signals.set(id, updated);
    return updated;
  }

  async findByTickerRecent(ticker: string, days = 3): Promise<SignalSnapshot | null> {
    const clean = ticker.toUpperCase().trim();
    const now = Date.now();
    for (const sig of dbClient.signals.values()) {
      if (sig.ticker === clean) {
        const sigTime = new Date(sig.signal_date).getTime();
        const diffDays = (now - sigTime) / (1000 * 60 * 60 * 24);
        if (diffDays < days) return sig;
      }
    }
    return null;
  }
}

export const signalRepository = new SignalRepository();
