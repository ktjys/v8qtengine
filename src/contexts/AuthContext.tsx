/**
 * Authentication Context for Quant Decision Engine.
 *
 * Single-user, admin-only auth with multi-mode resilience:
 *  1. Supabase Email OTP (Magic Link)
 *  2. Emergency 8-character Master Recovery Code & Passkey session
 *  3. Automatic server configuration bootstrap
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Session, User, AuthError } from '@supabase/supabase-js';
import { getAuthClient, initAuthClient, isAuthConfigured } from '../db/authClient';

export interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
  recoveryCode: string | null;      // 생성 시 한 번만 보이는 평문 복구 코드
  recoveryCodeShown: boolean;       // 사용자가 이미 본 상태인지
  configuredAdminEmail: string;     // 서버에 등록된 관리자 이메일
}

export interface AuthActions {
  signInWithOtp: (email: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
  clearError: () => void;
  generateRecoveryCode: () => Promise<{ code: string | null; error: string | null }>;
  verifyRecoveryCode: (code: string) => Promise<{ success: boolean; error: string | null }>;
}

const AuthContext = createContext<(AuthState & AuthActions) | null>(null);

const ADMIN_STORAGE_KEY = 'quant_engine_admin_session_v8';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
    error: null,
    recoveryCode: null,
    recoveryCodeShown: false,
    configuredAdminEmail: 'kanada250@gmail.com',
  });

  // Initial session & config restoration
  useEffect(() => {
    let isMounted = true;

    async function initializeAuth() {
      // 1) 서버에서 Auth 구성 정보 및 관리자 이메일 로드
      let client = getAuthClient();
      let defaultAdminEmail = 'kanada250@gmail.com';

      try {
        const res = await fetch('/api/v8/auth/config');
        if (res.ok) {
          const cfg = await res.json();
          if (cfg.adminEmail) {
            defaultAdminEmail = cfg.adminEmail;
          }
          if (!client && cfg.supabaseUrl && cfg.supabaseAnonKey) {
            client = initAuthClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
          }
        }
      } catch (err) {
        console.warn('[AuthProvider] Config bootstrap warning:', err);
      }

      if (!isMounted) return;

      // 2) 로컬스토리지에 저장된 소유자 관리자 세션 토큰 확인
      try {
        const rawLocalSession = localStorage.getItem(ADMIN_STORAGE_KEY);
        if (rawLocalSession) {
          const parsed = JSON.parse(rawLocalSession);
          if (parsed?.token && parsed?.expiresAt > Date.now()) {
            // 서버에 토큰 유효성 검증
            const verifyRes = await fetch('/api/v8/auth/verify-token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token: parsed.token }),
            });
            const verifyData = await verifyRes.json();
            if (verifyData.valid && isMounted) {
              const adminUser = {
                id: parsed.user?.id || 'admin-owner',
                email: parsed.user?.email || defaultAdminEmail,
                user_metadata: { role: 'admin', is_admin: true },
                app_metadata: { role: 'admin' },
              } as User;

              const adminSession = {
                access_token: parsed.token,
                user: adminUser,
              } as Session;

              setState((s) => ({
                ...s,
                user: adminUser,
                session: adminSession,
                loading: false,
                configuredAdminEmail: defaultAdminEmail,
              }));
              return;
            } else {
              localStorage.removeItem(ADMIN_STORAGE_KEY);
            }
          } else {
            localStorage.removeItem(ADMIN_STORAGE_KEY);
          }
        }
      } catch (err) {
        console.warn('[AuthProvider] Local admin session check warning:', err);
      }

      // 3) Supabase 세션 복원 (Supabase 클라이언트가 구성된 경우)
      if (client) {
        try {
          const { data } = await client.auth.getSession();
          if (data.session && isMounted) {
            setState((s) => ({
              ...s,
              session: data.session,
              user: data.session.user ?? null,
              loading: false,
              configuredAdminEmail: defaultAdminEmail,
            }));
            return;
          }
        } catch (err: any) {
          console.warn('[AuthProvider] Supabase session check error:', err);
        }
      }

      if (isMounted) {
        setState((s) => ({
          ...s,
          user: null,
          session: null,
          loading: false,
          configuredAdminEmail: defaultAdminEmail,
        }));
      }
    }

    initializeAuth();

    // 4) Supabase Auth 이벤트 구독 (변경 시 즉시 반응)
    const client = getAuthClient();
    let subscription: { unsubscribe: () => void } | null = null;
    if (client) {
      const { data } = client.auth.onAuthStateChange((_event, session) => {
        if (!isMounted) return;
        setState((s) => ({
          ...s,
          session,
          user: session?.user ?? null,
          loading: false,
          recoveryCode: null,
          recoveryCodeShown: false,
        }));
      });
      subscription = data.subscription;
    }

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  const signInWithOtp = useCallback(async (email: string) => {
    const client = getAuthClient();
    if (!client) {
      return {
        error: {
          name: 'AuthError',
          message: 'Supabase URL/Key가 준비되지 않았습니다. 복구 코드나 관리자 패스키로 즉시 진입하실 수 있습니다.',
        } as AuthError,
      };
    }
    setState((s) => ({ ...s, error: null }));
    const { error } = await client.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
      },
    });
    if (error) setState((s) => ({ ...s, error: error.message }));
    return { error };
  }, []);

  const signOut = useCallback(async () => {
    // 1) Supabase 세션 로그아웃
    const client = getAuthClient();
    if (client) {
      try {
        await client.auth.signOut();
      } catch {}
    }

    // 2) 로컬 관리자 토큰 세션 무효화
    try {
      const raw = localStorage.getItem(ADMIN_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.token) {
          await fetch('/api/v8/auth/logout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: parsed.token }),
          });
        }
      }
    } catch {}

    localStorage.removeItem(ADMIN_STORAGE_KEY);

    setState((s) => ({
      ...s,
      user: null,
      session: null,
      recoveryCode: null,
      recoveryCodeShown: false,
      error: null,
    }));
  }, []);

  const refreshSession = useCallback(async () => {
    const client = getAuthClient();
    if (client) {
      const { data: { session } } = await client.auth.refreshSession();
      setState((s) => ({ ...s, session, user: session?.user ?? null }));
    }
  }, []);

  const clearError = useCallback(() => {
    setState((s) => ({ ...s, error: null }));
  }, []);

  // 복구 코드 생성: 서버 엔드포인트 호출
  const generateRecoveryCode = useCallback(async () => {
    try {
      const res = await fetch('/api/v8/auth/recovery-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || '복구 코드 생성 실패');
      setState((s) => ({
        ...s,
        recoveryCode: data.code,
        recoveryCodeShown: true,
      }));
      return { code: data.code, error: null };
    } catch (err: any) {
      return { code: null, error: err.message };
    }
  }, []);

  // 복구 코드 검증: 서버 엔드포인트 호출 및 즉시 관리자 세션 수립
  const verifyRecoveryCode = useCallback(async (code: string) => {
    try {
      const res = await fetch('/api/v8/auth/verify-recovery-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || '복구 코드 검증 실패');

      // 인증 성공 시 세션 토큰 저장 및 상태 즉시 반영
      if (data.token) {
        const adminUser = {
          id: data.user?.id || 'admin-owner',
          email: data.user?.email || 'kanada250@gmail.com',
          user_metadata: { role: 'admin', is_admin: true },
          app_metadata: { role: 'admin' },
        } as User;

        const adminSession = {
          access_token: data.token,
          user: adminUser,
        } as Session;

        localStorage.setItem(
          ADMIN_STORAGE_KEY,
          JSON.stringify({
            token: data.token,
            user: adminUser,
            expiresAt: data.expiresAt,
          })
        );

        setState((s) => ({
          ...s,
          user: adminUser,
          session: adminSession,
          error: null,
          recoveryCode: null,
          recoveryCodeShown: false,
        }));
      }

      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        signInWithOtp,
        signOut,
        refreshSession,
        clearError,
        generateRecoveryCode,
        verifyRecoveryCode,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState & AuthActions {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}