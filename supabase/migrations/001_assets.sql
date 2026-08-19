-- 001_assets.sql
CREATE TABLE IF NOT EXISTS assets (
  ticker VARCHAR(20) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  asset_type VARCHAR(50) NOT NULL,
  exchange VARCHAR(50) DEFAULT 'US',
  sector VARCHAR(100),
  industry VARCHAR(100),
  currency VARCHAR(10) DEFAULT 'USD',
  is_active BOOLEAN DEFAULT true,
  metadata_json JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS watchlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker VARCHAR(20) NOT NULL UNIQUE REFERENCES assets(ticker) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  memo TEXT,
  priority INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
