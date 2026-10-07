/**
 * Browser-side Supabase client for AUTH ONLY.
 *
 * ⚠️ This is the ONLY module in the codebase allowed to read VITE_* env vars
 * and be imported from React components. Here is why that is safe:
 *
 *   - The value used here is the SUPABASE ANON (publishable) key, which is
 *     designed to be shipped to every browser. It is not a secret.
 *   - All data access through this client is governed by Row-Level Security
 *     policies in PostgreSQL. The anon key cannot bypass RLS.
 *   - The SERVICE ROLE key (real DB admin credentials) lives ONLY in
 *     src/db/supabaseClient.ts, which reads process.env server-side and is
 *     never imported by browser code.
 *
 * Auth (session tokens, OTP magic links) fundamentally requires a client-side
 * Supabase client — that is how Supabase Auth is designed to work. This module
 * exists solely to provide that, and it must never be used for raw table
 * reads/writes that should go through the server (use the REST API for that).
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

declare global {
  interface ImportMetaEnv {
    readonly VITE_SUPABASE_URL: string | undefined;
    readonly VITE_SUPABASE_ANON_KEY: string | undefined;
  }
  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

let supabaseUrl = (
  (typeof import.meta !== 'undefined' ? import.meta.env?.VITE_SUPABASE_URL : undefined) ||
  (typeof process !== 'undefined' ? process.env?.VITE_SUPABASE_URL : undefined) ||
  ''
).trim().replace(/^["']|["']$/g, '');

let supabaseAnonKey = (
  (typeof import.meta !== 'undefined' ? import.meta.env?.VITE_SUPABASE_ANON_KEY : undefined) ||
  (typeof process !== 'undefined' ? process.env?.VITE_SUPABASE_ANON_KEY : undefined) ||
  ''
).trim().replace(/^["']|["']$/g, '');

let authClient: SupabaseClient | null = null;

export function initAuthClient(url?: string, anonKey?: string): SupabaseClient | null {
  if (url) supabaseUrl = url.trim().replace(/^["']|["']$/g, '');
  if (anonKey) supabaseAnonKey = anonKey.trim().replace(/^["']|["']$/g, '');

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  authClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,        // 브라우저 재방문 시 세션 복원
      autoRefreshToken: true,      // 토큰 만료 전 자동 갱신
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      storageKey: 'quant_engine_auth_v8',
    },
  });

  return authClient;
}

export function getAuthClient(): SupabaseClient | null {
  if (authClient) return authClient;
  if (supabaseUrl && supabaseAnonKey) {
    return initAuthClient();
  }
  return null;
}

export function isAuthConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey);
}