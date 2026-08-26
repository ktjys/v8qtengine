import { runHistoricalBackfill } from '../../../../src/engine/backfillEngine';

// POST /api/v8/backtest/backfill
export async function onRequest(context: any) {
  try {
    let body: any = {};
    if (context.request.method === 'POST') {
      try {
        body = await context.request.json();
      } catch {}
    }

    const { lookbackRange, tickers, opportunityThreshold, replaceExisting } = body;
    const result = await runHistoricalBackfill({
      lookbackRange: lookbackRange || '1y',
      tickers,
      opportunityThreshold: opportunityThreshold ? Number(opportunityThreshold) : 70,
      replaceExisting: replaceExisting ?? true,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `과거 ${lookbackRange || '1y'} 데이터 백필 완료: ${result.totalBarsIngested}개 봉과 ${result.totalSignalsGenerated}개 시그널이 생성 및 적재되었습니다.`,
        result,
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
        error: err.message || 'Backfill execution error',
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
