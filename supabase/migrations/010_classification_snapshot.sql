-- 010_classification_snapshot.sql
-- Point-in-Time 분류 스냅샷: 수동 오버라이드가 유효해지는 기준일(effective_date)을
-- 기록하여, 백테스트에서 미래에 설정된 분류 오버라이드가 과거 날짜에 적용되는
-- look-ahead bias를 방지한다 (FundamentalsRepository의 getAsOf PIT 패턴과 동일).
CREATE TABLE IF NOT EXISTS classification_snapshot (
  ticker VARCHAR(20) NOT NULL REFERENCES assets(ticker) ON DELETE CASCADE,
  effective_date DATE NOT NULL,
  asset_type VARCHAR(20) NOT NULL,
  strategy_type VARCHAR(50) NOT NULL,
  confidence NUMERIC(4, 2) DEFAULT 1.0,
  reason TEXT,
  source VARCHAR(20) DEFAULT 'manual',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (ticker, effective_date)
);
