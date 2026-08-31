import { scanService } from '../../../../src/pipeline/scanService';
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

    const simulatePartialFailure = body.simulate_partial_failure === true;
    const providerType = body.provider_type as 'yahoo' | 'seed' | undefined;

    let scanResult: any;
    try {
      scanResult = await scanService.executeScan({
        simulatePartialFailure,
        providerType,
        saveToDb: true,
      });
    } catch (scanErr) {
      console.warn('[EdgeScan] scanService.executeScan failed, falling back to seed pipeline:', scanErr);
      const seedRes = runV8PipelineOnSeedData();
      const duration = Date.now() - startTime;
      const runLog = {
        run_id: `edge-run-${Date.now()}`,
        started_at: new Date(startTime).toISOString(),
        finished_at: new Date().toISOString(),
        watchlist_count: seedRes.watchlist.length,
        evaluated_count: seedRes.evaluations.length,
        failure_count: simulatePartialFailure ? 1 : 0,
        status: simulatePartialFailure ? 'PARTIAL_SUCCESS' : 'SUCCESS',
        error_summary: simulatePartialFailure
          ? 'Simulated quote API timeout on last ticker (Gracefully isolated)'
          : undefined,
      };

      const actionableSignals = seedRes.evaluations.filter((e) => e.signal_generated);
      scanResult = {
        runLog: {
          ...runLog,
          error_summary: runLog.error_summary || 'Fallback evaluation (seed simulation)',
        },
        newSignals: actionableSignals.map((ev) => ({
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
        evaluations: seedRes.evaluations,
      };
    }

    const actionableSignals = scanResult.evaluations.filter(
      (ev: any) => ev.signal_generated
    );

    return new Response(
      JSON.stringify({
        success: true,
        scan_log: scanResult.runLog,
        new_signals: scanResult.newSignals || [],
        actionable_signals: actionableSignals,
        evaluations_count: scanResult.evaluations.length,
        evaluations: scanResult.evaluations,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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

export const onRequestGet = onRequest;
export const onRequestPost = onRequest;
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
