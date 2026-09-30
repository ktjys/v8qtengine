-- 011_watchlist_market_region.sql
-- watchlist 테이블에 시장 지역 컬럼(market_region)을 추가한다.
--
-- 배경:
--   커밋 f3214dd(per-market watchlist capacity)가 워치리스트 용량을 시장별로
--   분리 제한하기 위해 market_region을 도입했다. 코드(watchlistRepository.add/update,
--   watchlistRoutes)는 market_region을 쓰기 시작했으나 대응하는 DB 마이그레이션이
--   함께 배포되지 않았다. 그 결과 실DB에 컬럼이 없는 상태에서
--   PGRST204("Could not find the 'market_region' column ... in the schema cache")
--   가 발생했고, handleDbError()가 이 메시지를 "테이블 없음"으로 오인해 watchlist
--   테이블을 missingTables로 봉쇄했다. 그 결과 이후 모든 워치리스트 쓰기가
--   in-memory Map 갱신만 수행하고 DB에는 반영되지 않았다.
--
-- 이 마이그레이션은 누락된 컬럼을 복구하고 기존 행을 backfill 한다.
-- INSERT/UPDATE/DELETE는 market_region을 계속 쓰므로 필수다.

ALTER TABLE watchlist ADD COLUMN IF NOT EXISTS market_region VARCHAR(2);

-- 기존 행 backfill: 티커 표기로 시장 지역을 추정한다.
--   - '.KS' / '.KQ' 접미사는 한국(KRX) 시장
--   - 그 외(영문 티커)는 미국 시장
-- detectMarketRegion()의 동작과 동일한 규칙을 SQL에서 재현한다.
UPDATE watchlist
SET market_region = CASE
  WHEN ticker LIKE '%.KS' OR ticker LIKE '%.KQ' THEN 'KR'
  WHEN ticker ~ '^[0-9]{6}$' THEN 'KR'
  ELSE 'US'
END
WHERE market_region IS NULL;

-- 용량 검증(marketCount >= MAX_WATCHLIST_CAPACITY_PER_MARKET)과
-- 시장별 필터 쿼리가 이 인덱스를 사용한다.
CREATE INDEX IF NOT EXISTS idx_watchlist_market_region ON watchlist (market_region);

-- CONSTRAINT 제약 대신 DEFAULT + backfill로 처리한다.
-- 기존 테이블에 이미 market_region이 다른 제약으로 존재하는 deployments를 위해
-- NOT NULL 추가는 실패할 수 있으므로 DEFAULT만 보장하고 CHECK는 가볍게 건다.
ALTER TABLE watchlist ALTER COLUMN market_region SET DEFAULT 'US';
