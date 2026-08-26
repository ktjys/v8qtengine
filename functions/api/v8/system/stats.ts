import { runV8PipelineOnSeedData, INITIAL_HISTORICAL_SIGNALS, INITIAL_SCAN_RUNS } from '../../../../src/data/seed/initialData';

// GET /api/v8/system/stats
export async function onRequest(context: any) {
  try {
    const { evaluations, watchlist } = runV8PipelineOnSeedData();

    return new Response(
      JSON.stringify({
        success: true,
        stats: {
          watchlist_count: watchlist.length,
          evaluations_count: evaluations.length,
          signals_count: INITIAL_HISTORICAL_SIGNALS.length,
          runs_count: INITIAL_SCAN_RUNS.length,
          last_scan_time: new Date().toISOString(),
          edge_runtime: true,
        },
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
