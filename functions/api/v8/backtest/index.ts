import { INITIAL_HISTORICAL_SIGNALS } from '../../../../src/data/seed/initialData';
import { calculateBacktestMetrics } from '../../../../src/engine/backtestEngine';

// GET or POST /api/v8/backtest
export async function onRequest(context: any) {
  try {
    const summary = calculateBacktestMetrics(INITIAL_HISTORICAL_SIGNALS);

    return new Response(
      JSON.stringify({
        success: true,
        summary,
        signals: INITIAL_HISTORICAL_SIGNALS,
        all_signals: INITIAL_HISTORICAL_SIGNALS,
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
        error: err.message || 'Internal Server Error',
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
