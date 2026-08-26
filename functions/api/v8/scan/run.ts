import { runV8PipelineOnSeedData } from '../../../../src/data/seed/initialData';

// POST or ALL /api/v8/scan/run
export async function onRequest(context: any) {
  const { request } = context || {};
  const startTime = Date.now();

  try {
    let body: any = {};
    try {
      if (request?.json) {
        body = await request.json();
      }
    } catch {}

    const result = runV8PipelineOnSeedData();
    const duration = Date.now() - startTime;

    const runLog = {
      run_id: `edge-run-${Date.now()}`,
      started_at: new Date(startTime).toISOString(),
      finished_at: new Date().toISOString(),
      watchlist_count: result.watchlist.length,
      evaluated_count: result.evaluations.length,
      failure_count: body.simulate_partial_failure ? 1 : 0,
      status: body.simulate_partial_failure ? 'PARTIAL_SUCCESS' : 'SUCCESS',
      error_summary: body.simulate_partial_failure ? 'Simulated quote API timeout on last ticker (Gracefully isolated)' : undefined,
    };

    const actionableSignals = result.evaluations.filter((e) => e.decision.actionable);

    return new Response(
      JSON.stringify({
        success: true,
        scan_log: runLog,
        new_signals: actionableSignals.map((ev) => ({
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
        })),
        evaluations_count: result.evaluations.length,
        evaluations: result.evaluations,
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
      JSON.stringify({
        success: false,
        error: err.message || 'Edge scan failed',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
}
