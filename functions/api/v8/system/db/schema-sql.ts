import { FULL_SCHEMA_SQL } from '../../../../../src/db/schemaSql';

// GET /api/v8/system/db/schema-sql
export async function onRequest(context: any) {
  return new Response(
    JSON.stringify({
      success: true,
      sql: FULL_SCHEMA_SQL,
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
}

export const onRequestGet = onRequest;
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
