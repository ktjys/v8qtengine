import { INITIAL_HISTORICAL_SIGNALS, runV8PipelineOnSeedData } from '../../../src/data/seed/initialData';

// GET /api/v8/signals
export async function onRequest(context: any) {
  try {
    const { evaluations } = runV8PipelineOnSeedData();
    const liveSignals = evaluations
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
        status: 'ACTIVE',
      }));

    const combined = [...liveSignals, ...INITIAL_HISTORICAL_SIGNALS];

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
