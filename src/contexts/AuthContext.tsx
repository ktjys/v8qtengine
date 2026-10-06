/**
 * Authentication Context for Quant Decision Engine.
 *
 * Single-user, admin-only auth using Supabase Email OTP (Magic Link).
 * Recovery code provides email-independent fallback.
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Session, User, AuthError } from '@supabase/supabase-js';
import { getAuthClient, isAuthConfigured } from '../db/authClient';

export interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
  recoveryCode: string | null;      // 생성 시 한 번만 보이는 평문 복구 코드
  recoveryCodeShown: boolean;       // 사용자가 이미 본 상태인지
}

export interface AuthActions {
  signInWithOtp: (email: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
  clearError: () => void;
  generateRecoveryCode: () => Promise<{ code: string | null; error: string | null }>;
  verifyRecoveryCode: (code: string) => Promise<{ success: boolean; error: string | null }>;
}

const AuthContext = createContext<AuthState & AuthActions | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
    error: null,
    recoveryCode: null,
    recoveryCodeShown: false,
  });

  const authClient = getAuthClient();

  // Initial session check
  useEffect(() => {
    if (!authClient) {
      setState((s) => ({ ...s, loading: false, error: '인증 미구성: VITE_SUPABASE_URL/ANON_KEY 필요' }));
      return;
    }

    // 1) 즉시 세션 복원
    authClient.auth.getSession().then(({ data }) => {
      const session = data.session;
      setState((s) => ({
        ...s,
        session,
        user: session?.user ?? null,
        loading: false,
      }));
    }).catch((err) => {
      setState((s) => ({ ...s, loading: false, error: err.message }));
    });

    // 2) 이후 인증 상태 변화 구독
    const {
      data: { subscription },
    } = authClient.auth.onAuthStateChange(
      async (_event, session) => {
        setState((s) => ({
          ...s,
          session,
          user: session?.user ?? null,
          loading: false,
          // 로그인 시 복구 코드 상태 초기화
          recoveryCode: null,
          recoveryCodeShown: false,
        }));
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [authClient]);

  const signInWithOtp = useCallback(async (email: string) => {
    if (!authClient) return { error: { message: '인증 미구성' } as AuthError };
    setState((s) => ({ ...s, error: null }));
    const { error } = await authClient.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
      },
    });
    if (error) setState((s) => ({ ...s, error: error.message }));
    return { error };
  }, [authClient]);

  const signOut = useCallback(async () => {
    if (!authClient) return;
    await authClient.auth.signOut();
    setState((s) => ({
      ...s,
      user: null,
      session: null,
      recoveryCode: null,
      recoveryCodeShown: false,
    }));
  }, [authClient]);

  const refreshSession = useCallback(async () => {
    if (!authClient) return;
    const { data: { session } } = await authClient.auth.refreshSession();
    setState((s) => ({ ...s, session, user: session?.user ?? null }));
  }, [authClient]);

  const clearError = useCallback(() => {
    setState((s) => ({ ...s, error: null }));
  }, []);

  // 복구 코드 생성: 서버 엔드포인트 호출 (service 키로 동작)
  const generateRecoveryCode = useCallback(async () => {
    try {
      const res = await fetch('/api/v8/auth/recovery-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '복구 코드 생성 실패');
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

  // 복구 코드 검증: 서버 엔드포인트 호출
  const verifyRecoveryCode = useCallback(async (code: string) => {
    try {
      const res = await fetch('/api/v8/auth/verify-recovery-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '복구 코드 검증 실패');
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

// Helper: 현재 세션의 access token 가져오기 (서버 API 호출 시 Authorization 헤더용)
export function getAccessToken(): string | null {
  const client = getAuthClient();
  if (!client) return null;
  const session = client.auth.getSession().then(({ data }) => data.session);
  return null; // Note: This helper is deprecated - use client.auth.getSession() directly
}