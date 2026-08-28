import { signalRepository } from '../../../src/db/repositories/signalRepository';
import { evaluationRepository } from '../../../src/db/repositories/evaluationRepository';
import { INITIAL_HISTORICAL_SIGNALS, runV8PipelineOnSeedData } from '../../../src/data/seed/initialData';

// GET /api/v8/signals
export async function onRequest(context: any) {
  try {
    let savedSignals = await signalRepository.getAll();
    const evals = await evaluationRepository.getAll();

    const todayStr = new Date().toISOString().split('T')[0];
    const liveSignals = evals
      .filter((e) => e.decision?.actionable)
      .map((ev) => ({
        id: `sig-${ev.ticker}-${todayStr}`,
        signal_date: todayStr,
        ticker: ev.ticker,
        name: ev.name,
        signal_price: ev.price,
        strategy_type: ev.classification?.strategy_type || 'CORE_MOMENTUM',
        asset_type: ev.classification?.asset_type || 'equity',
        opportunity_score: ev.opportunity?.opportunity_score ?? 70,
        risk_score: ev.risk?.risk_score ?? 50,
        risk_level: ev.risk?.risk_level || 'MEDIUM',
        decision: ev.decision?.decision || 'OPPORTUNITY',
        signal_confidence: ev.decision?.confidence ?? 0.8,
        classification_confidence: ev.classification?.confidence ?? 1.0,
        primary_reason: ev.decision?.reason || '',
        created_at: new Date().toISOString(),
        status: 'ACTIVE' as const,
      }));

    const signalMap = new Map<string, any>();
    INITIAL_HISTORICAL_SIGNALS.forEach((s) => {
      const key = `${s.ticker}_${s.signal_date}`;
      signalMap.set(key, s);
    });
    savedSignals.forEach((s) => {
      const key = `${s.ticker}_${s.signal_date}`;
      signalMap.set(key, s);
    });
    liveSignals.forEach((s) => {
      const key = `${s.ticker}_${s.signal_date}`;
      // If already exists with outcomes, keep the saved one
      if (!signalMap.has(key)) {
        signalMap.set(key, s);
      }
    });

    const combined = Array.from(signalMap.values()).sort((a, b) =>
      b.signal_date.localeCompare(a.signal_date)
    );

    return new Response(
      JSON.stringify({
        success: true,
        count: combined.length,
        signals: combined,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      }
    );
  }
}

export const onRequestGet = onRequest;
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
