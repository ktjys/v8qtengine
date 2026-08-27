import { dbClient } from '../src/db/supabaseClient';

// Cloudflare Pages Functions do not populate Node's `process.env` with
// dashboard-configured Variables/Secrets — those only arrive per-request via
// `context.env`. `dbClient` (src/db/supabaseClient.ts) is a module-level
// singleton that only reads `process.env` once at cold-start, so without this
// middleware every function under functions/api/** would run with the DB
// permanently disconnected regardless of what's set in the dashboard.
//
// This runs once before any /api/* request and wires the trusted, per-request
// env binding into dbClient exactly once per isolate. It is server-only:
// `context.env` is never reachable from the browser, so this does not
// reintroduce any client-side credential exposure.
let dbInitStarted = false;

export async function onRequest(context: any) {
  if (!dbInitStarted && !dbClient.isSupabaseConnected) {
    dbInitStarted = true;
    const env = (context.env || {}) as Record<string, string | undefined>;
    const url = env.SUPABASE_URL || '';
    const key = env.SUPABASE_KEY || '';
    if (url && key) {
      try {
        await dbClient.connectFromTrustedEnv(url, key);
      } catch (err) {
        console.error('[functions/_middleware] Supabase connect failed:', err);
      }
    }
  }

  return context.next();
}
