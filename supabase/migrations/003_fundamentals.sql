-- 003_fundamentals.sql
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

-- 004_indicators.sql
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

-- 005_evaluations.sql
CREATE TABLE IF NOT EXISTS evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker VARCHAR(20) NOT NULL REFERENCES assets(ticker) ON DELETE CASCADE,
  evaluation_date TIMESTAMPTZ NOT NULL,
  score_version VARCHAR(20) DEFAULT 'V8.0',
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
