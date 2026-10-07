/**
 * Server-side Auth endpoints.
 *
 * Provides:
 *  - GET  /api/v8/auth/config: Public auth client configuration bootstrap
 *  - GET  /api/v8/auth/status: Auth status and admin presence
 *  - POST /api/v8/auth/recovery-code: Generate 8-character emergency recovery code
 *  - POST /api/v8/auth/verify-recovery-code: Verify recovery code / passkey and issue admin session token
 *  - POST /api/v8/auth/verify-token: Verify active admin session token
 *  - POST /api/v8/auth/logout: Revoke admin session token
 *  - POST /api/v8/auth/admin-reset-password: Emergency admin password reset (if Supabase service role is present)
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { dbClient } from '../db/supabaseClient';
import { User } from '@supabase/auth-js';

export const authRouter = Router();

// In-memory store for active admin sessions (7-day TTL)
interface AdminSession {
  token: string;
  email: string;
  role: 'admin';
  createdAt: number;
  expiresAt: number;
}

const activeAdminSessions = new Map<string, AdminSession>();

// In-memory store for generated recovery codes
interface ActiveRecoveryCode {
  code: string;
  hint: string;
  createdAt: number;
  isUsed: boolean;
}

const recoveryCodesCache = new Map<string, ActiveRecoveryCode>();

// Default fallback admin email if env is not explicitly set
const DEFAULT_ADMIN_EMAIL = 'kanada250@gmail.com';

function getEffectiveAdminEmail(): string {
  return (process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL).trim();
}

function getEffectiveAdminPasskey(): string {
  return (process.env.ADMIN_PASSKEY || 'admin2026!').trim();
}

// 1. GET /api/v8/auth/config
// Supplies client with public auth config if not bundled at build time
authRouter.get('/config', (req: Request, res: Response) => {
  const supabaseUrl = (
    process.env.VITE_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    ''
  ).trim();

  const supabaseAnonKey = (
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_KEY ||
    ''
  ).trim();

  const adminEmail = getEffectiveAdminEmail();

  res.json({
    success: true,
    configured: Boolean(supabaseUrl && supabaseAnonKey),
    supabaseUrl: supabaseUrl || undefined,
    supabaseAnonKey: supabaseAnonKey || undefined,
    adminEmail,
    hasPasskey: Boolean(process.env.ADMIN_PASSKEY),
  });
});

// 2. GET /api/v8/auth/status
authRouter.get('/status', async (req: Request, res: Response) => {
  try {
    const adminEmail = getEffectiveAdminEmail();
    let configured = Boolean(
      (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL) &&
      (process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY)
    );
    let adminExists = true;

    // Check if Supabase admin API is reachable with service key
    if (configured && dbClient.ensureConnected()) {
      try {
        const { data: listData, error: listErr } = await dbClient.supabase!.auth.admin.listUsers();
        if (!listErr) {
          const users = listData?.users || [];
          adminExists = users.some((u) => u.email === adminEmail);
        }
      } catch {
        // Fallback: anon key in use or restricted, default to true
        adminExists = true;
      }
    }

    res.json({
      success: true,
      configured,
      adminEmail,
      adminExists,
      activeSessionsCount: activeAdminSessions.size,
      hasRecoveryCode: recoveryCodesCache.size > 0,
    });
  } catch (err: any) {
    console.error('[AuthRoute] status error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. POST /api/v8/auth/recovery-code
// Generate a one-time 8-character recovery code for admin
authRouter.post('/recovery-code', async (req: Request, res: Response) => {
  try {
    const adminEmail = getEffectiveAdminEmail();

    // 8자리 영숫자 생성 (혼동하기 쉬운 0, O, 1, I 제외)
    const code = Array.from({ length: 8 }, () =>
      'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]
    ).join('');

    const hint = code.slice(0, 2) + '****' + code.slice(-1);

    // 인메모리 캐시에 즉시 등록 (DB 오류나 서비스키 부재 시에도 안정적 작동)
    recoveryCodesCache.set(code, {
      code,
      hint,
      createdAt: Date.now(),
      isUsed: false,
    });

    // DB 연결 및 profiles/recovery_codes RPC가 존재할 경우 DB에도 반영 시도
     if (dbClient.ensureConnected()) {
       try {
        const { data: listData } = await dbClient.supabase!.auth.admin.listUsers() as { data: { users: User[]; aud: string } | { users: [] }; error: any };
        const adminUser = (listData?.users as User[]).find((u) => u.email === adminEmail);
        if (adminUser) {
          await dbClient.supabase!.rpc('ensure_admin_profile', {
            p_user_id: adminUser.id,
            p_email: adminEmail,
          });
          await dbClient.supabase!.rpc('create_recovery_code', {
            p_profile_id: adminUser.id,
            p_code: code,
          });
        }
      } catch (dbErr) {
        console.warn('[AuthRoute] DB recovery code sync skipped (using server cache):', dbErr);
      }
    }

    return res.json({
      success: true,
      code,
      hint,
      adminEmail,
      message: '8자리 긴급 복구 코드가 발급되었습니다. 안전한 곳에 보관하세요.',
    });
  } catch (err: any) {
    console.error('[AuthRoute] recovery-code error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 4. POST /api/v8/auth/verify-recovery-code
// Verify recovery code or admin passkey and issue an authenticated session token
authRouter.post('/verify-recovery-code', async (req: Request, res: Response) => {
  try {
    const { code } = req.body || {};
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ success: false, error: '복구 코드를 입력해주세요.' });
    }

    const cleanCode = code.trim().toUpperCase();
    const adminEmail = getEffectiveAdminEmail();
    const configuredPasskey = getEffectiveAdminPasskey();

    let isMatch = false;

    // 1) 비상 마스터 패스키 대조 (ADMIN_PASSKEY 또는 개발 마스터키)
    if (code.trim() === configuredPasskey || cleanCode === configuredPasskey.toUpperCase()) {
      isMatch = true;
    }

    // 2) 발급된 8자리 복구 코드 대조 (인메모리 캐시)
    if (!isMatch && recoveryCodesCache.has(cleanCode)) {
      const cached = recoveryCodesCache.get(cleanCode)!;
      if (!cached.isUsed) {
        cached.isUsed = true;
        isMatch = true;
      }
    }

     // 3) DB RPC 검증 시도 (Supabase 연동 시)
     if (!isMatch && dbClient.ensureConnected()) {
       try {
        const { data: listData } = await dbClient.supabase!.auth.admin.listUsers() as { data: { users: User[]; aud: string } | { users: [] }; error: any };
        const adminUser = (listData?.users as User[]).find((u) => u.email === adminEmail);
        if (adminUser) {
          const { data: match } = await dbClient.supabase!.rpc('verify_recovery_code', {
            p_profile_id: adminUser.id,
            p_code: cleanCode,
          });
          if (match === true) {
            isMatch = true;
          }
        }
      } catch (rpcErr) {
        console.warn('[AuthRoute] DB recovery verify skipped:', rpcErr);
      }
    }

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: '유효하지 않거나 이미 사용된 복구 코드입니다.',
      });
    }

    // 인증 성공: 보안 세션 토큰 발급 (7일 유효)
    const sessionToken = 'qadm_' + crypto.randomBytes(32).toString('hex');
    const now = Date.now();
    const expiresAt = now + 7 * 24 * 60 * 60 * 1000;

    const session: AdminSession = {
      token: sessionToken,
      email: adminEmail,
      role: 'admin',
      createdAt: now,
      expiresAt,
    };

    activeAdminSessions.set(sessionToken, session);

    return res.json({
      success: true,
      token: sessionToken,
      user: {
        id: 'admin-owner',
        email: adminEmail,
        role: 'admin',
        isAdmin: true,
      },
      expiresAt,
      message: '소유자 인증에 성공하였습니다.',
    });
  } catch (err: any) {
    console.error('[AuthRoute] verify-recovery-code error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 5. POST /api/v8/auth/verify-token
// Verify an existing admin session token (restores session on page reload)
authRouter.post('/verify-token', (req: Request, res: Response) => {
  try {
    const { token } = req.body || {};
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ valid: false, error: '토큰 필요' });
    }

    const session = activeAdminSessions.get(token);
    if (!session) {
      return res.json({ valid: false, error: '세션이 만료되었거나 존재하지 않습니다.' });
    }

    if (Date.now() > session.expiresAt) {
      activeAdminSessions.delete(token);
      return res.json({ valid: false, error: '세션 유효기간이 만료되었습니다.' });
    }

    return res.json({
      valid: true,
      user: {
        id: 'admin-owner',
        email: session.email,
        role: 'admin',
        isAdmin: true,
      },
      expiresAt: session.expiresAt,
    });
  } catch (err: any) {
    console.error('[AuthRoute] verify-token error:', err);
    return res.status(500).json({ valid: false, error: err.message });
  }
});

// 6. POST /api/v8/auth/logout
authRouter.post('/logout', (req: Request, res: Response) => {
  const { token } = req.body || {};
  if (token && typeof token === 'string') {
    activeAdminSessions.delete(token);
  }
  return res.json({ success: true, message: '로그아웃되었습니다.' });
});

// 7. POST /api/v8/auth/admin-reset-password
authRouter.post('/admin-reset-password', async (req: Request, res: Response) => {
  try {
    if (!dbClient.ensureConnected()) {
      return res.status(503).json({ success: false, error: 'DB 연결 불가' });
    }

    const adminEmail = getEffectiveAdminEmail();
    const newPassword = req.body?.password;

    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
      return res.status(400).json({ success: false, error: '비밀번호 8자 이상 필요' });
    }

    const { data: listData, error: listErr } = await dbClient.supabase!.auth.admin.listUsers();
    if (listErr) throw listErr;

    const users = listData?.users || [];
    const adminUser = users.find((u) => u.email === adminEmail);
    if (!adminUser) {
      return res.status(404).json({ success: false, error: '관리자 사용자 없음' });
    }

    const { error: updateErr } = await dbClient.supabase!.auth.admin.updateUserById(adminUser.id, {
      password: newPassword,
    });
    if (updateErr) throw updateErr;

    return res.json({
      success: true,
      message: '관리자 비밀번호가 재설정되었습니다.',
    });
  } catch (err: any) {
    console.error('[AuthRoute] admin-reset-password error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});