import { INITIAL_SCAN_RUNS } from '../../../src/data/seed/initialData';

// GET /api/v8/runs
export async function onRequest(context: any) {
  try {
    return new Response(
      JSON.stringify({
        success: true,
        count: INITIAL_SCAN_RUNS.length,
        runs: INITIAL_SCAN_RUNS,
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
