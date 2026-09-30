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
export async function onRequest(context: any) {
  if (!dbClient.isSupabaseConnected) {
    const env = (context.env || {}) as Record<string, string | undefined>;
    const url = (
      env.SUPABASE_URL ||
      env.VITE_SUPABASE_URL ||
      (typeof process !== 'undefined' ? (process.env?.SUPABASE_URL || process.env?.VITE_SUPABASE_URL) : '') ||
      ''
    ).trim().replace(/^["']|["']$/g, '');

    const key = (
      env.SUPABASE_KEY ||
      env.SUPABASE_ANON_KEY ||
      env.SUPABASE_SERVICE_ROLE_KEY ||
      env.VITE_SUPABASE_ANON_KEY ||
      (typeof process !== 'undefined'
        ? (process.env?.SUPABASE_KEY ||
           process.env?.SUPABASE_ANON_KEY ||
           process.env?.SUPABASE_SERVICE_ROLE_KEY ||
           process.env?.VITE_SUPABASE_ANON_KEY)
        : '') ||
      ''
    ).trim().replace(/^["']|["']$/g, '');

    if (url && key) {
      try {
        await dbClient.connectFromTrustedEnv(url, key);
        if (typeof process !== 'undefined' && process.env) {
          process.env.SUPABASE_URL = url;
          process.env.SUPABASE_KEY = key;
        }
      } catch (err) {
        console.error('[functions/_middleware] Supabase connect failed:', err);
      }
    }
  }

  return context.next();
}

