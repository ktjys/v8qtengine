import { runV8PipelineOnSeedData } from '../../../src/data/seed/initialData';

// GET or POST /api/v8/classification
export async function onRequest(context: any) {
  try {
    const { evaluations } = runV8PipelineOnSeedData();
    const classifications = evaluations.map((e) => ({
      ticker: e.ticker,
      name: e.name,
      ...e.classification,
    }));

    return new Response(
      JSON.stringify({
        success: true,
        count: classifications.length,
        classifications,
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
