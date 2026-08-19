-- 006_signals.sql
CREATE TABLE IF NOT EXISTS signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker VARCHAR(20) NOT NULL REFERENCES assets(ticker) ON DELETE CASCADE,
  signal_date DATE NOT NULL,
  score_version VARCHAR(20) DEFAULT 'V8.0',
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

-- 007_signal_outcomes.sql
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

-- 008_scan_runs.sql
CREATE TABLE IF NOT EXISTS scan_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ,
  watchlist_count INT NOT NULL,
  evaluated_count INT NOT NULL,
  signal_count INT NOT NULL,
  failure_count INT NOT NULL,
  status VARCHAR(30) NOT NULL,
  version VARCHAR(20) DEFAULT 'V8.0',
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

-- 009_indexes.sql
CREATE INDEX IF NOT EXISTS idx_market_data_ticker_date ON market_data_daily (ticker, trade_date DESC);
CREATE INDEX IF NOT EXISTS idx_evaluations_ticker ON evaluations (ticker, evaluation_date DESC);
CREATE INDEX IF NOT EXISTS idx_signals_date ON signals (signal_date DESC);
CREATE INDEX IF NOT EXISTS idx_scan_runs_started ON scan_runs (started_at DESC);
