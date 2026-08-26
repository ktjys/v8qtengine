import { signalRepository } from '../../../src/db/repositories/signalRepository';
import { evaluationRepository } from '../../../src/db/repositories/evaluationRepository';
import { INITIAL_HISTORICAL_SIGNALS, runV8PipelineOnSeedData } from '../../../src/data/seed/initialData';

// GET /api/v8/signals
export async function onRequest(context: any) {
  try {
    let savedSignals = await signalRepository.getAll();
    const evals = await evaluationRepository.getAll();

    const liveSignals = evals
      .filter((e) => e.decision?.actionable)
      .map((ev) => ({
        id: `sig-${ev.ticker}-${Date.now()}`,
        signal_date: new Date().toISOString().split('T')[0],
        ticker: ev.ticker,
        name: ev.name,
        signal_price: ev.price,
        strategy_type: ev.classification.strategy_type,
        asset_type: ev.classification.asset_type,
        opportunity_score: ev.opportunity.opportunity_score,
        risk_score: ev.risk.risk_score,
        risk_level: ev.risk.risk_level,
        decision: ev.decision.decision,
        signal_confidence: ev.decision.confidence,
        classification_confidence: ev.classification.confidence,
        primary_reason: ev.decision.reason,
        created_at: new Date().toISOString(),
        status: 'ACTIVE' as const,
      }));

    const signalMap = new Map<string, any>();
    savedSignals.forEach((s) => signalMap.set(`${s.ticker}-${s.signal_date}`, s));
    INITIAL_HISTORICAL_SIGNALS.forEach((s) => {
      const key = `${s.ticker}-${s.signal_date}`;
      if (!signalMap.has(key)) signalMap.set(key, s);
    });
    liveSignals.forEach((s) => signalMap.set(`${s.ticker}-${s.signal_date}`, s));

    const combined = Array.from(signalMap.values());

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
