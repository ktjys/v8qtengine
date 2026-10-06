-- 012_admin_profiles.sql
-- 단일 관리자(소유자) 인증 기반: 관리자 프로필 & 복구 코드
--
-- 배경:
--   기존 스키마는 Row-Level Security를 모두 해제한 상태(anon/authenticated 모두
--   FULL ACCESS)로 배포되어 있어, 어떤 사용자든 모든 테이블을 자유롭게 읽고
--   쓸 수 있다. 개인 프로젝트이지만 nonetheless "누구나 DB를 뒤tam"은 보안
--   결함이다. 이 마이그레이션은 관리자 인증(소유자) 기반의 최소 구현을 위한
--   테이블을 추가한다.
--
-- 설계 원칙 (단일 사용자):
--   - auth.users(Supabase Auth)는 사용자 정체성 관리. 별도 테이블 불필요.
--   - profiles: 관리자 추가 정보(이메일 고정, 복구 코드 사용 여부).
--   - recovery_codes: 비밀번호/매직 링크 실패 시 최후의 복구 수단.
--     이메일 의존성 제거를 위해 "한 번만 보이는" 복구 코드를 저장한다.
--   - RLS: 기존 13개 테이블은 이미 DISABLE + USING(true) 정책으로 공개.
--     이 마이그raction에서는 신규 테이블에만 본인 전용 정책을 적용한다.
--     (나중에 다중 사용자 전환 시 기존 테이블에 owner_id를 추가하면 된다.)

-- 1. 관리자 프로필 (auth.users와 1:1 매핑)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  recovery_code_used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. 복구 코드 (해시 저장). 평문은 절대 저장하지 않는다.
--     crypt()/gen_salt()는 pgcrypto 확장이 제공한다. (기존 스키마에 이미 ENABLE)
CREATE TABLE IF NOT EXISTS recovery_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,          -- crypt(code, gen_salt('bfx', 8))
  code_hint CHAR(1) NOT NULL,       -- 평문 노출 방지를 위해 첫 글자만 저장 (예: 'A****')
  is_used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  used_at TIMESTAMPTZ,
  CONSTRAINT recovery_codes_profile_unique_active
    EXCLUDE (profile_id WITH =) WHERE (is_used = false)
);

-- 3. RLS: 본인만 본다
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE recovery_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own_profile" ON profiles;
CREATE POLICY "own_profile" ON profiles
  FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "own_recovery_codes" ON recovery_codes;
CREATE POLICY "own_recovery_codes" ON recovery_codes
  FOR ALL USING (auth.uid() = profile_id) WITH CHECK (auth.uid() = profile_id);

-- service_role(서버)은 RLS를 무시하므로 관리자 재설정 스크립트/엔드포인트는
-- service 키로 동작하여 복구 코드를 자유롭게 생성·재설정할 수 있다.

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON TABLE profiles TO authenticated, service_role;
GRANT ALL ON TABLE recovery_codes TO authenticated, service_role;

-- 4. RPC 헬퍼 함수 (서버에서 service 키로만 호출)

-- 4-1. 복구 코드 생성: pgcrypto crypt()로 해시 저장, code_hint 첫 글자 저장
CREATE OR REPLACE FUNCTION create_recovery_code(p_profile_id UUID, p_code TEXT)
RETURNS VOID AS $$
BEGIN
  -- 기존 미사용 코드는 모두 무효화
  UPDATE recovery_codes
  SET is_used = true, used_at = NOW()
  WHERE profile_id = p_profile_id AND is_used = false;

  INSERT INTO recovery_codes (profile_id, code_hash, code_hint)
  VALUES (p_profile_id, crypt(p_code, gen_salt('bfx', 8)), LEFT(p_code, 1));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4-2. 복구 코드 검증: crypt(input, stored_hash) == stored_hash
CREATE OR REPLACE FUNCTION verify_recovery_code(p_profile_id UUID, p_code TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_hash TEXT;
BEGIN
  SELECT rc.code_hash INTO v_hash
  FROM recovery_codes rc
  WHERE rc.profile_id = p_profile_id
    AND rc.is_used = false
  ORDER BY rc.created_at DESC
  LIMIT 1;

  IF v_hash IS NULL THEN
    RETURN FALSE;
  END IF;

  IF crypt(p_code, v_hash) = v_hash THEN
    UPDATE recovery_codes
    SET is_used = true, used_at = NOW()
    WHERE profile_id = p_profile_id AND is_used = false AND code_hash = v_hash;
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4-3. 관리자 프로필 생성/보정 (서버 전용)
CREATE OR REPLACE FUNCTION ensure_admin_profile(p_user_id UUID, p_email TEXT)
RETURNS VOID AS $$
BEGIN
  INSERT INTO profiles (id, email, is_admin)
  VALUES (p_user_id, p_email, true)
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    is_admin = TRUE,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION create_recovery_code TO service_role;
GRANT EXECUTE ON FUNCTION verify_recovery_code TO service_role;
GRANT EXECUTE ON FUNCTION ensure_admin_profile TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;