-- 002_market_data.sql
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
