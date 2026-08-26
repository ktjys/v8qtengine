import { runV8PipelineOnSeedData } from '../../../src/data/seed/initialData';

// GET or POST /api/v8/evaluations
export async function onRequest(context: any) {
  try {
    const result = runV8PipelineOnSeedData();
    return new Response(
      JSON.stringify({
        success: true,
        count: result.evaluations.length,
        evaluations: result.evaluations,
        provider: 'Seed (Edge Ready)',
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
