// Complete unified SQL DDL script for Supabase / PostgreSQL schema setup

export const FULL_SCHEMA_SQL = `-- ==============================================================================
-- 🚀 Quant Decision & Signal Engine - Unified Database Schema
-- Run this complete script in your Supabase SQL Editor (or PostgreSQL client)
-- ==============================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Master Assets Table
CREATE TABLE IF NOT EXISTS assets (
  ticker VARCHAR(20) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  asset_type VARCHAR(50) NOT NULL DEFAULT 'equity',
  exchange VARCHAR(50) DEFAULT 'US',
  sector VARCHAR(100),
  industry VARCHAR(100),
  currency VARCHAR(10) DEFAULT 'USD',
  is_active BOOLEAN DEFAULT true,
  metadata_json JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Watchlist Table
CREATE TABLE IF NOT EXISTS watchlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker VARCHAR(20) NOT NULL UNIQUE REFERENCES assets(ticker) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  memo TEXT,
  priority INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Daily Market Data (OHLCV)
CREATE TABLE IF NOT EXISTS market_data_daily (
  ticker VARCHAR(20) NOT NULL REFERENCES assets(ticker) ON DELETE CASCADE,
  trade_date DATE NOT NULL,
  open NUMERIC(12, 4) NOT NULL,
  high NUMERIC(12, 4) NOT NULL,
  low NUMERIC(12, 4) NOT NULL,
  close NUMERIC(12, 4) NOT NULL,
  adj_close NUMERIC(12, 4) NOT NULL,
  volume BIGINT NOT NULL,
  source VARCHAR(50) DEFAULT 'yahoo',
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (ticker, trade_date)
);

-- 5. Fundamentals & Valuation Metrics
CREATE TABLE IF NOT EXISTS fundamentals (
  ticker VARCHAR(20) NOT NULL REFERENCES assets(ticker) ON DELETE CASCADE,
  as_of_date DATE NOT NULL,
  published_at DATE,
  period_end_date DATE,
  revenue NUMERIC(16, 2),
  revenue_growth NUMERIC(8, 4),
  eps NUMERIC(8, 4),
  eps_growth NUMERIC(8, 4),
  operating_margin NUMERIC(8, 4),
  free_cash_flow NUMERIC(16, 2),
  fcf_margin NUMERIC(8, 4),
  market_cap NUMERIC(16, 2) NOT NULL,
  trailing_pe NUMERIC(8, 2),
  forward_pe NUMERIC(8, 2),
  ps_ratio NUMERIC(8, 2),
  peg_ratio NUMERIC(8, 2),
  source VARCHAR(50) DEFAULT 'yahoo',
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (ticker, as_of_date)
);

-- 6. Technical & Momentum Indicator Snapshots
CREATE TABLE IF NOT EXISTS indicator_snapshots (
  ticker VARCHAR(20) NOT NULL REFERENCES assets(ticker) ON DELETE CASCADE,
  trade_date DATE NOT NULL,
  price NUMERIC(12, 4) NOT NULL,
  ma20 NUMERIC(12, 4) NOT NULL,
  ma50 NUMERIC(12, 4) NOT NULL,
  ma200 NUMERIC(12, 4) NOT NULL,
  rsi14 NUMERIC(6, 2) NOT NULL,
  macd NUMERIC(10, 4),
  macd_signal NUMERIC(10, 4),
  macd_histogram NUMERIC(10, 4),
  drawdown_52w NUMERIC(8, 4),
  return_1m NUMERIC(8, 4),
  return_3m NUMERIC(8, 4),
  return_6m NUMERIC(8, 4),
  return_12m NUMERIC(8, 4),
  relative_strength_spy NUMERIC(8, 4),
  beta NUMERIC(6, 2),
  volatility_20d NUMERIC(8, 4),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (ticker, trade_date)
);

-- 7. Realtime Decision & Evaluation Results
CREATE TABLE IF NOT EXISTS evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker VARCHAR(20) NOT NULL REFERENCES assets(ticker) ON DELETE CASCADE,
  evaluation_date TIMESTAMPTZ NOT NULL,
  strategy_type VARCHAR(50) NOT NULL,
  technical_score INT NOT NULL,
  momentum_score INT NOT NULL,
  fundamental_score INT,
  valuation_score INT,
  opportunity_score INT NOT NULL,
  risk_score INT NOT NULL,
  risk_level VARCHAR(20) NOT NULL,
  decision VARCHAR(50) NOT NULL,
  confidence NUMERIC(4, 2) NOT NULL,
  signal_generated BOOLEAN NOT NULL DEFAULT FALSE,
  reason_json JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Immutable Quant Signal Ledger
CREATE TABLE IF NOT EXISTS signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker VARCHAR(20) NOT NULL REFERENCES assets(ticker) ON DELETE CASCADE,
  signal_date DATE NOT NULL,
  strategy_type VARCHAR(50) NOT NULL,
  opportunity_score INT NOT NULL,
  risk_score INT NOT NULL,
  risk_level VARCHAR(20) NOT NULL,
  decision VARCHAR(50) NOT NULL,
  confidence NUMERIC(4, 2) NOT NULL,
  entry_price NUMERIC(12, 4) NOT NULL,
  technical_score INT NOT NULL,
  momentum_score INT NOT NULL,
  fundamental_score INT,
  valuation_score INT,
  reason_json JSONB,
  status VARCHAR(30) DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Post-Signal Performance Tracking (5D/10D/20D Outcomes)
CREATE TABLE IF NOT EXISTS signal_outcomes (
  signal_id UUID PRIMARY KEY REFERENCES signals(id) ON DELETE CASCADE,
  evaluation_date DATE NOT NULL,
  price NUMERIC(12, 4) NOT NULL,
  return_1d NUMERIC(8, 4),
  return_5d NUMERIC(8, 4),
  return_10d NUMERIC(8, 4),
  return_20d NUMERIC(8, 4),
  max_gain NUMERIC(8, 4),
  max_loss NUMERIC(8, 4),
  is_win_5d BOOLEAN,
  is_win_10d BOOLEAN,
  is_win_20d BOOLEAN,
  closed_at TIMESTAMPTZ
);

-- 10. Scan Runs & Health Execution Logs
CREATE TABLE IF NOT EXISTS scan_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ,
  watchlist_count INT NOT NULL,
  evaluated_count INT NOT NULL,
  signal_count INT NOT NULL,
  failure_count INT NOT NULL,
  status VARCHAR(30) NOT NULL,
  error_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scan_run_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_run_id UUID NOT NULL REFERENCES scan_runs(id) ON DELETE CASCADE,
  ticker VARCHAR(20) NOT NULL,
  status VARCHAR(30) NOT NULL,
  error_code VARCHAR(50),
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ NOT NULL
);

-- 11. Alert Notifications History
CREATE TABLE IF NOT EXISTS alert_notifications (
  id VARCHAR(100) PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL,
  kst_time VARCHAR(50) NOT NULL,
  strategy_type VARCHAR(50) NOT NULL,
  title TEXT NOT NULL,
  tickers TEXT[] NOT NULL DEFAULT '{}',
  signals_count INT DEFAULT 0,
  delivery_status VARCHAR(30) NOT NULL DEFAULT 'SENT',
  delivery_target VARCHAR(100),
  message_preview TEXT,
  message_body TEXT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Classification Snapshots Table (Point-in-Time asset classification overrides)
CREATE TABLE IF NOT EXISTS classification_snapshots (
  ticker VARCHAR(20) NOT NULL REFERENCES assets(ticker) ON DELETE CASCADE,
  effective_date DATE NOT NULL,
  asset_type VARCHAR(50) NOT NULL DEFAULT 'equity',
  strategy_type VARCHAR(50) NOT NULL DEFAULT 'CORE_VALUE',
  confidence NUMERIC(4, 2) DEFAULT 0.8,
  reason TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (ticker, effective_date)
);

-- Compatibility view for classification_snapshot (singular alias)
CREATE OR REPLACE VIEW classification_snapshot AS SELECT * FROM classification_snapshots;

-- 13. Schema Compatibility Migrations (Automatically adds any missing columns to existing tables)
ALTER TABLE IF EXISTS assets ADD COLUMN IF NOT EXISTS name VARCHAR(255) DEFAULT '';
ALTER TABLE IF EXISTS assets ADD COLUMN IF NOT EXISTS asset_type VARCHAR(50) DEFAULT 'equity';
ALTER TABLE IF EXISTS assets ADD COLUMN IF NOT EXISTS exchange VARCHAR(50) DEFAULT 'US';
ALTER TABLE IF EXISTS assets ADD COLUMN IF NOT EXISTS sector VARCHAR(100);
ALTER TABLE IF EXISTS assets ADD COLUMN IF NOT EXISTS industry VARCHAR(100);
ALTER TABLE IF EXISTS assets ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'USD';
ALTER TABLE IF EXISTS assets ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE IF EXISTS assets ADD COLUMN IF NOT EXISTS metadata_json JSONB;
ALTER TABLE IF EXISTS assets ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE IF EXISTS assets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE IF EXISTS watchlist ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE IF EXISTS watchlist ADD COLUMN IF NOT EXISTS memo TEXT;
ALTER TABLE IF EXISTS watchlist ADD COLUMN IF NOT EXISTS priority INT DEFAULT 1;
ALTER TABLE IF EXISTS watchlist ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE IF EXISTS watchlist ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE IF EXISTS signals ADD COLUMN IF NOT EXISTS confidence NUMERIC(4, 2) DEFAULT 0.8;
ALTER TABLE IF EXISTS signals ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'ACTIVE';
ALTER TABLE IF EXISTS signals ADD COLUMN IF NOT EXISTS technical_score INT DEFAULT 70;
ALTER TABLE IF EXISTS signals ADD COLUMN IF NOT EXISTS momentum_score INT DEFAULT 70;
ALTER TABLE IF EXISTS signals ADD COLUMN IF NOT EXISTS fundamental_score INT;
ALTER TABLE IF EXISTS signals ADD COLUMN IF NOT EXISTS valuation_score INT;
ALTER TABLE IF EXISTS signals ADD COLUMN IF NOT EXISTS reason_json JSONB;
ALTER TABLE IF EXISTS signals ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE IF EXISTS signals ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE IF EXISTS signal_outcomes ADD COLUMN IF NOT EXISTS return_1d NUMERIC(8, 4);
ALTER TABLE IF EXISTS signal_outcomes ADD COLUMN IF NOT EXISTS return_5d NUMERIC(8, 4);
ALTER TABLE IF EXISTS signal_outcomes ADD COLUMN IF NOT EXISTS return_10d NUMERIC(8, 4);
ALTER TABLE IF EXISTS signal_outcomes ADD COLUMN IF NOT EXISTS return_20d NUMERIC(8, 4);
ALTER TABLE IF EXISTS signal_outcomes ADD COLUMN IF NOT EXISTS max_gain NUMERIC(8, 4);
ALTER TABLE IF EXISTS signal_outcomes ADD COLUMN IF NOT EXISTS max_loss NUMERIC(8, 4);
ALTER TABLE IF EXISTS signal_outcomes ADD COLUMN IF NOT EXISTS is_win_5d BOOLEAN;
ALTER TABLE IF EXISTS signal_outcomes ADD COLUMN IF NOT EXISTS is_win_10d BOOLEAN;
ALTER TABLE IF EXISTS signal_outcomes ADD COLUMN IF NOT EXISTS is_win_20d BOOLEAN;
ALTER TABLE IF EXISTS signal_outcomes ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

ALTER TABLE IF EXISTS scan_runs ADD COLUMN IF NOT EXISTS error_summary TEXT;
ALTER TABLE IF EXISTS scan_runs ADD COLUMN IF NOT EXISTS failure_count INT DEFAULT 0;

-- 14. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_watchlist_active ON watchlist (is_active);
CREATE INDEX IF NOT EXISTS idx_market_data_ticker_date ON market_data_daily (ticker, trade_date DESC);
CREATE INDEX IF NOT EXISTS idx_evaluations_ticker_date ON evaluations (ticker, evaluation_date DESC);
CREATE INDEX IF NOT EXISTS idx_signals_date ON signals (signal_date DESC);
CREATE INDEX IF NOT EXISTS idx_signals_ticker ON signals (ticker);
CREATE INDEX IF NOT EXISTS idx_scan_runs_started ON scan_runs (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_notifications_time ON alert_notifications (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_classification_snapshots_date ON classification_snapshots (effective_date DESC);

-- 15. Universal Permissive RLS Policies & Grants for Anon & Authenticated Access
ALTER TABLE IF EXISTS assets DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS watchlist DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS market_data_daily DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS fundamentals DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS indicator_snapshots DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS evaluations DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS signals DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS signal_outcomes DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS scan_runs DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS scan_run_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS alert_notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS classification_snapshots DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all assets" ON assets;
CREATE POLICY "Allow all assets" ON assets FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all watchlist" ON watchlist;
CREATE POLICY "Allow all watchlist" ON watchlist FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all market_data_daily" ON market_data_daily;
CREATE POLICY "Allow all market_data_daily" ON market_data_daily FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all fundamentals" ON fundamentals;
CREATE POLICY "Allow all fundamentals" ON fundamentals FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all indicator_snapshots" ON indicator_snapshots;
CREATE POLICY "Allow all indicator_snapshots" ON indicator_snapshots FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all evaluations" ON evaluations;
CREATE POLICY "Allow all evaluations" ON evaluations FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all signals" ON signals;
CREATE POLICY "Allow all signals" ON signals FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all signal_outcomes" ON signal_outcomes;
CREATE POLICY "Allow all signal_outcomes" ON signal_outcomes FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all scan_runs" ON scan_runs;
CREATE POLICY "Allow all scan_runs" ON scan_runs FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all scan_run_items" ON scan_run_items;
CREATE POLICY "Allow all scan_run_items" ON scan_run_items FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all alert_notifications" ON alert_notifications;
CREATE POLICY "Allow all alert_notifications" ON alert_notifications FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all classification_snapshots" ON classification_snapshots;
CREATE POLICY "Allow all classification_snapshots" ON classification_snapshots FOR ALL USING (true) WITH CHECK (true);

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- 16. Admin Profiles & Recovery Codes (소유자 인증 기반)
--   auth.users와 1:1 매핑된 관리자 프로필과, 이메일 의존성 제로를 위한
--   복구 코드(해시 저장) 테이블. 신규 테이블에만 본인 전용 RLS 정책 적용.
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  recovery_code_used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recovery_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  code_hint CHAR(1) NOT NULL,
  is_used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  used_at TIMESTAMPTZ,
  CONSTRAINT recovery_codes_profile_unique_active
    EXCLUDE (profile_id WITH =) WHERE (is_used = false)
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE recovery_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own_profile" ON profiles;
CREATE POLICY "own_profile" ON profiles
  FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "own_recovery_codes" ON recovery_codes;
CREATE POLICY "own_recovery_codes" ON recovery_codes
  FOR ALL USING (auth.uid() = profile_id) WITH CHECK (auth.uid() = profile_id);

GRANT ALL ON TABLE profiles TO authenticated, service_role;
GRANT ALL ON TABLE recovery_codes TO authenticated, service_role;

-- 4. RPC 헬퍼 함수 (서버에서 service 키로만 호출)

-- 4-1. 복구 코드 생성: pgcrypto crypt()로 해시 저장, code_hint 첫 글자 저장
CREATE OR REPLACE FUNCTION create_recovery_code(p_profile_id UUID, p_code TEXT)
RETURNS VOID AS $$
BEGIN
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
`;

export const ALL_TABLES_RLS_FIX_SQL = `-- ==============================================================================
-- ⚡ Supabase 전체 테이블 RLS 해제 및 anon/authenticated 쓰기 권한 일괄 부여
-- Supabase Dashboard > SQL Editor에 복사하여 [Run] 버튼을 클릭하세요.
-- ==============================================================================
ALTER TABLE IF EXISTS assets DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS watchlist DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS market_data_daily DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS fundamentals DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS indicator_snapshots DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS evaluations DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS signals DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS signal_outcomes DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS scan_runs DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS scan_run_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS alert_notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS classification_snapshots DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all assets" ON assets;
CREATE POLICY "Allow all assets" ON assets FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all watchlist" ON watchlist;
CREATE POLICY "Allow all watchlist" ON watchlist FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all market_data_daily" ON market_data_daily;
CREATE POLICY "Allow all market_data_daily" ON market_data_daily FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all fundamentals" ON fundamentals;
CREATE POLICY "Allow all fundamentals" ON fundamentals FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all indicator_snapshots" ON indicator_snapshots;
CREATE POLICY "Allow all indicator_snapshots" ON indicator_snapshots FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all evaluations" ON evaluations;
CREATE POLICY "Allow all evaluations" ON evaluations FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all signals" ON signals;
CREATE POLICY "Allow all signals" ON signals FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all signal_outcomes" ON signal_outcomes;
CREATE POLICY "Allow all signal_outcomes" ON signal_outcomes FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all scan_runs" ON scan_runs;
CREATE POLICY "Allow all scan_runs" ON scan_runs FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all scan_run_items" ON scan_run_items;
CREATE POLICY "Allow all scan_run_items" ON scan_run_items FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all alert_notifications" ON alert_notifications;
CREATE POLICY "Allow all alert_notifications" ON alert_notifications FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all classification_snapshots" ON classification_snapshots;
CREATE POLICY "Allow all classification_snapshots" ON classification_snapshots FOR ALL USING (true) WITH CHECK (true);

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
`;
