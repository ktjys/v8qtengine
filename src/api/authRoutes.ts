/**
 * Server-side Auth endpoints (service role key).
 *
 * These endpoints use the server-side Supabase client (service role key)
 * to perform admin operations that bypass RLS:
 *  - Generate recovery code (hash stored in DB, plaintext returned once)
 *  - Verify recovery code
 *  - Admin password reset (emergency)
 */

import { Router, Request, Response } from 'express';
import { dbClient } from '../db/supabaseClient';

export const authRouter = Router();

// POST /api/v8/auth/recovery-code
// Generate a one-time recovery code for the admin user.
// Returns plaintext code ONCE — caller must show it to user immediately.
authRouter.post('/recovery-code', async (req: Request, res: Response) => {
  try {
    if (!dbClient.ensureConnected()) {
      return res.status(503).json({ success: false, error: 'DB 연결 불가' });
    }

    const adminEmail = process.env.ADMIN_EMAIL?.trim();
    if (!adminEmail) {
      return res.status(500).json({ success: false, error: 'ADMIN_EMAIL 환경변수 미설정' });
    }

    // 1. 관리자 사용자 찾기 (auth.users)
    const { data: listData, error: listErr } = await dbClient.supabase!.auth.admin.listUsers();
    if (listErr) throw listErr;

    const users = listData?.users || [];
    const adminUser = users.find((u) => u.email === adminEmail);
    if (!adminUser) {
      return res.status(404).json({ success: false, error: '관리자 사용자 없음 (먼저 Supabase Auth에서 가입 필요)' });
    }

    // 2. 프로필 확인/생성 (ensure_admin_profile RPC)
    const { error: profErr } = await dbClient.supabase!.rpc('ensure_admin_profile', {
      p_user_id: adminUser.id,
      p_email: adminEmail,
    });
    if (profErr) throw profErr;

    // 3. 복구 코드 생성 (8자리 영숫자)
    const code = Array.from({ length: 8 }, () =>
      'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]
    ).join('');

    // 해시 저장 (create_recovery_code RPC — pgcrypto crypt())
    const { error: hashErr } = await dbClient.supabase!.rpc('create_recovery_code', {
      p_profile_id: adminUser.id,
      p_code: code,
    });
    if (hashErr) throw hashErr;

    // 4. 평문 코드 한 번만 반환 (호출자가 바로 사용자에게 보여줘야 함)
    return res.json({
      success: true,
      code,
      hint: code[0] + '****',
      message: '복구 코드가 생성되었습니다. 안전한 곳에 저장하세요. 다시는 볼 수 없습니다.',
    });
  } catch (err: any) {
    console.error('[AuthRoute] recovery-code error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v8/auth/verify-recovery-code
// Verify a recovery code against stored hash.
authRouter.post('/verify-recovery-code', async (req: Request, res: Response) => {
  try {
    if (!dbClient.ensureConnected()) {
      return res.status(503).json({ success: false, error: 'DB 연결 불가' });
    }

    const { code } = req.body || {};
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ success: false, error: '코드 필요' });
    }

    const adminEmail = process.env.ADMIN_EMAIL?.trim();
    if (!adminEmail) {
      return res.status(500).json({ success: false, error: 'ADMIN_EMAIL 미설정' });
    }

    const { data: listData, error: listErr } = await dbClient.supabase!.auth.admin.listUsers();
    if (listErr) throw listErr;

    const users = listData?.users || [];
    const adminUser = users.find((u) => u.email === adminEmail);
    if (!adminUser) {
      return res.status(404).json({ success: false, error: '관리자 사용자 없음' });
    }

    // 미사용 복구 코드 조회 후 pgcrypto로 검증
    const { data: codes, error: codeErr } = await dbClient.supabase!
      .from('recovery_codes')
      .select('id, code_hash')
      .eq('profile_id', adminUser.id)
      .eq('is_used', false)
      .order('created_at', { ascending: false })
      .limit(1);

    if (codeErr) throw codeErr;
    if (!codes || codes.length === 0) {
      return res.status(400).json({ success: false, error: '유효한 복구 코드 없음' });
    }

    const storedHash = codes[0].code_hash;

    // 복구 코드 검증 (verify_recovery_code RPC — crypt()로 해시 비교, 성공 시 자동 사용 처리)
    const { data: match, error: verifyErr } = await dbClient.supabase!.rpc('verify_recovery_code', {
      p_profile_id: adminUser.id,
      p_code: code,
    });

    if (verifyErr) throw verifyErr;
    if (match === true) {
      return res.json({ success: true });
    }

    return res.status(401).json({ success: false, error: '복구 코드 불일치' });
  } catch (err: any) {
    console.error('[AuthRoute] verify-recovery-code error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v8/auth/admin-reset-password
// Emergency admin password reset using service role.
// Only works if ADMIN_EMAIL is set and user exists.
authRouter.post('/admin-reset-password', async (req: Request, res: Response) => {
  try {
    if (!dbClient.ensureConnected()) {
      return res.status(503).json({ success: false, error: 'DB 연결 불가' });
    }

    const adminEmail = process.env.ADMIN_EMAIL?.trim();
    const newPassword = req.body?.password;

    if (!adminEmail) {
      return res.status(500).json({ success: false, error: 'ADMIN_EMAIL 미설정' });
    }
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

    // 복구 코드도 초기화 (새 비밀번호로 로그인 가능)
    await dbClient.supabase!
      .from('recovery_codes')
      .update({ is_used: true, used_at: new Date().toISOString() })
      .eq('profile_id', adminUser.id)
      .eq('is_used', false);

    return res.json({
      success: true,
      message: '관리자 비밀번호가 재설정되었습니다. 복구 코드는 모두 무효화되었습니다.',
    });
  } catch (err: any) {
    console.error('[AuthRoute] admin-reset-password error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/v8/auth/status
// Check if auth is configured and admin user exists
authRouter.get('/status', async (req: Request, res: Response) => {
  try {
    const configured = isAuthConfigured();
    let adminExists = false;
    let adminEmail = process.env.ADMIN_EMAIL?.trim() || null;

    if (configured && dbClient.ensureConnected()) {
      const { data: listData, error: listErr } = await dbClient.supabase!.auth.admin.listUsers();
      if (!listErr) {
        const users = listData?.users || [];
        adminExists = users.some((u) => u.email === adminEmail);
      }
    }

    res.json({
      success: true,
      configured,
      adminEmail,
      adminExists,
      hasRecoveryCode: false, // Could check recovery_codes table if needed
    });
  } catch (err: any) {
    console.error('[AuthRoute] status error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Helper: check if VITE env is configured (for client to know)
function isAuthConfigured(): boolean {
  return Boolean(
    process.env.VITE_SUPABASE_URL &&
    process.env.VITE_SUPABASE_ANON_KEY
  );
}