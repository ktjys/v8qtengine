-- ==============================================================================
-- 🚀 Quant Decision & Signal Engine - Scan Chunking Migration
-- Run this in your Supabase SQL Editor after 011_watchlist_market_region.sql
-- ==============================================================================

-- 1. Add chunking columns to scan_runs
ALTER TABLE IF EXISTS scan_runs
ADD COLUMN IF NOT EXISTS market_region VARCHAR(10);

ALTER TABLE IF EXISTS scan_runs
ADD COLUMN IF NOT EXISTS chunk_size INTEGER;

ALTER TABLE IF EXISTS scan_runs
ADD COLUMN IF NOT EXISTS total_chunks INTEGER;

ALTER TABLE IF EXISTS scan_runs
ADD COLUMN IF NOT EXISTS completed_chunks INTEGER NOT NULL DEFAULT 0;

ALTER TABLE IF EXISTS scan_runs
ADD COLUMN IF NOT EXISTS failed_chunks INTEGER NOT NULL DEFAULT 0;

ALTER TABLE IF EXISTS scan_runs
ADD COLUMN IF NOT EXISTS meta JSONB NOT NULL DEFAULT '{}';

-- 2. Add indexes for chunking queries
CREATE INDEX IF NOT EXISTS idx_scan_runs_status ON scan_runs (status);
CREATE INDEX IF NOT EXISTS idx_scan_runs_market_region ON scan_runs (market_region);

-- 3. RPC function for atomic chunk completion and finalization
CREATE OR REPLACE FUNCTION record_scan_chunk(
  p_scan_run_id UUID,
  p_chunk_status TEXT,
  p_evaluated_count INTEGER DEFAULT 0,
  p_signal_count INTEGER DEFAULT 0,
  p_failure_count INTEGER DEFAULT 0
) RETURNS BOOLEAN
LANGUAGE PLPGSQL
AS $$
DECLARE
  v_total INTEGER;
  v_completed INTEGER;
  v_failed INTEGER;
  v_evaluated INTEGER;
  v_finalized BOOLEAN;
BEGIN
  UPDATE scan_runs
  SET
    evaluated_count = evaluated_count + p_evaluated_count,
    signal_count = signal_count + p_signal_count,
    failure_count = failure_count + p_failure_count,
    completed_chunks = completed_chunks + CASE
      WHEN p_chunk_status IN ('SUCCESS', 'PARTIAL_SUCCESS') THEN 1 ELSE 0
    END,
    failed_chunks = failed_chunks + CASE
      WHEN p_chunk_status = 'FAILED' THEN 1 ELSE 0
    END
  WHERE id = p_scan_run_id;

  SELECT total_chunks, completed_chunks, failed_chunks, evaluated_count
  INTO v_total, v_completed, v_failed, v_evaluated
  FROM scan_runs
  WHERE id = p_scan_run_id;

  v_finalized := FALSE;

  IF v_total IS NOT NULL AND v_total > 0 AND v_completed + v_failed >= v_total THEN
    UPDATE scan_runs
    SET
      status = CASE
        WHEN v_failed > 0 AND COALESCE(v_evaluated, 0) = 0 THEN 'FAILED'
        WHEN v_failed > 0 OR failure_count > 0 THEN 'PARTIAL_SUCCESS'
        ELSE 'SUCCESS'
      END,
      finished_at = NOW()
    WHERE id = p_scan_run_id
      AND status = 'RUNNING';

    v_finalized := FOUND;
  END IF;

  RETURN v_finalized;
END;
$$;

GRANT EXECUTE ON FUNCTION record_scan_chunk(UUID, TEXT, INTEGER, INTEGER, INTEGER) TO anon, authenticated, service_role;

-- 5. Ensure scan_run_items has proper structure (already exists but ensure indexes)
CREATE INDEX IF NOT EXISTS idx_scan_run_items_scan_run_id ON scan_run_items (scan_run_id);
CREATE INDEX IF NOT EXISTS idx_scan_run_items_status ON scan_run_items (status);