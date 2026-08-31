import { scanService } from '../../../../src/pipeline/scanService';

// POST or ALL /api/v8/scan/run
export async function onRequest(context: any) {
  const { request } = context || {};

  try {
    let body: any = {};
    try {
      if (request?.json) {
        body = await request.json();
      }
    } catch {}

    const simulatePartialFailure = body.simulate_partial_failure === true;
    const providerType = body.provider_type as 'yahoo' | 'seed' | undefined;

    const scanResult = await scanService.executeScan({
      simulatePartialFailure,
      providerType: providerType || 'yahoo',
      saveToDb: true,
    });

    const actionableSignals = (scanResult.evaluations || []).filter(
      (ev: any) => ev.signal_generated
    );

    return new Response(
      JSON.stringify({
        success: true,
        scan_log: scanResult.runLog,
        new_signals: scanResult.newSignals || [],
        actionable_signals: actionableSignals,
        evaluations_count: (scanResult.evaluations || []).length,
        evaluations: scanResult.evaluations || [],
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
