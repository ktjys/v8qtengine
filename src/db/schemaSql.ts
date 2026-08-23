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

-- 11. Schema Compatibility Migrations (Automatically adds any missing columns to existing tables)
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

-- 12. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_watchlist_active ON watchlist (is_active);
CREATE INDEX IF NOT EXISTS idx_market_data_ticker_date ON market_data_daily (ticker, trade_date DESC);
CREATE INDEX IF NOT EXISTS idx_evaluations_ticker_date ON evaluations (ticker, evaluation_date DESC);
CREATE INDEX IF NOT EXISTS idx_signals_date ON signals (signal_date DESC);
CREATE INDEX IF NOT EXISTS idx_signals_ticker ON signals (ticker);
CREATE INDEX IF NOT EXISTS idx_scan_runs_started ON scan_runs (started_at DESC);

-- 13. Disable RLS or Allow Public Access (For API Server Service/Anon Key access)
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
`;
