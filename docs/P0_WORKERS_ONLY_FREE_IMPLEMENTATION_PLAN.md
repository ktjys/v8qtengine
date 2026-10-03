# P0: Workers-only Free Implementation Plan

- 문서: `docs/P0_WORKERS_ONLY_FREE_IMPLEMENTATION_PLAN.md`
- 작성일: 2026-10-03
- 상태: **실행 대기**
- 전제 문서: `docs/PROJECT_DIRECTION_DECISION.md`
- 목표: 별도 앱 서버 없이 **Cloudflare Workers/Pages Functions + Supabase**만으로 UI/API/스캔/스케줄링을 운영하는 **Workers-only Free 구조**로 전환한다.

---

## 1. 핵심 목표

1. **production primary runtime을 Cloudflare Workers/Pages Functions로 고정**
2. **Node/Express는 local development용으로만 남김**
3. **스캔은 계속 실행되되, 한 invocation에서 전체를 돌리지 않음**
4. **Cloudflare Free plan의 subrequest/CPU 한도 안에서 동작하도록 chunking을 도입**
5. **보안/신뢰성 P0를 동시에 보강**

---

## 2. Non-Goals (P0에서 하지 않는 것)

- LLM/AI 멀티모델 도입
- 공개 프로덕션 서비스화
- 자율 트레이딩
- portfolio/paper trading 확대
- 모델 로직 자체의 전면 재설계
- Cloudflare Paid 기반 최적화

---

## 3. 목표 아키텍처

```text
Browser UI (Cloudflare Pages / Worker Assets)
        |
Cloudflare Worker / Pages Functions
  - static UI serving
  - API routes
  - cron trigger entry
        |
Scan Orchestrator
  - market/slot resolution
  - watchlist load
  - chunking
  - queue enqueue
        |
Cloudflare Queue
        |
Chunk Worker Invocation (1 call = 1 small chunk)
  - 2~3 tickers only
  - cache-first market data
  - evaluation + signal generation
  - Supabase write
  - progress update
        |
Finalizer
  - all chunks complete check
  - scan run close
  - Telegram send once
        |
Supabase
  - market_data_daily
  - evaluations
  - signals
  - scan_runs
  - scan_run_items
  - alert_notifications
```

---

## 4. 현재 코드 기준 GAP

### 4.1. `worker.ts`
- `/api/v8/scan/run`
  - 현재 `scanService.executeScan()`을 한 요청 안에서 전체 market 기준으로 실행
- `/api/v8/cron-scan`
  - 현재 `executeCronScan()`을 sync 또는 `ctx.waitUntil()` 백그라운드로 실행
- `scheduled()`
  - Cloudflare Cron 트리거가 오면 바로 `executeCronScan()` 실행
- 문제
  - Free plan 한 invocation 내에서 US 전체 스캔을 수행하면 subrequest/CPU 예산 초과 가능

### 4.2. `src/engine/cronScanEngine.ts`
- `executeCronScan()`
  - watchlist 전체 스캔
  - 25초 safety timeout
  - 실패 시 DB cache
  - 그마저 없으면 seed fallback
  - Telegram 발송
  - scan run log 기록
  - 전부 한 경로에서 수행
- 문제
  - Workers-only Free 구조에는 부적합
  - seed fallback이 운영 경로에 섞이면 신호 신뢰성 훼손

### 4.3. `src/pipeline/scanService.ts`
- `executeScan()`
  - market 전체 ticker를 batch size 10으로 처리
  - scan run log를 한 번에 저장
- 문제
  - chunk 단위의 progress/finalization 구조가 없음

### 4.4. DB/Repository
- `scan_runs`
  - chunking 상태를 추적할 컬럼이 부족
- `scan_run_items`
  - 현재 `scanRunRepository.save()`에서 item-level 영속화가 불완전
- 문제
  - chunk별 진행 상태와 finalizer 이دلempotency를 DB로 보장하기 어려움

### 4.5. 보안
- `/api/v8/scan/run`
- `/api/v8/schedule/trigger`
- `/api/v8/system/db/clear`
- `/api/v8/system/db/seed`
- `/api/v8/telegram/test-broadcast`
  - 현재 인증이 약하거나 없음
- 문제
  - Workers-only로 공개 실행하면 제3자가 스캔/설정/DB 조작 가능

---

## 5. P0 Work Packages

## WP-1. Wrangler/Queue/Build 구조 확정

### 목표
- Workers-only production 구조를 빌드/배포 설정에 고정한다.

### 작업
- `wrangler.toml`
  - Queue producer/consumer 추가
  - 기존 `assets`, `main`, `crons` 유지
  - `API_AUTH_TOKEN`, `CRON_SECRET_TOKEN`, `TELEGRAM_*`, `SUPABASE_*`는 secret/vars 정책 유지
- `package.json`
  - `dev:worker`, `deploy`, `deploy:dry-run` 스크립트 추가
  - production 기준 build path를 Worker 중심으로 정리
- `functions/`
  - P0에서는 **legacy**로 취급
  - production target은 `worker.ts` + `dist` assets 기준으로 고정

### 권장 wrangler.toml 추가
```toml
[[queues.producers]]
binding = "SCAN_QUEUE"
queue = "v8-scan-chunks"

[[queues.consumers]]
queue = "v8-scan-chunks"
max_batch_size = 1
max_retries = 2
dead_letter_queue = "v8-scan-dead"
```

### package.json 스크립트 예시
```json
{
  "dev:worker": "wrangler dev",
  "deploy": "vite build && wrangler deploy",
  "deploy:dry-run": "vite build && wrangler deploy --dry-run"
}
```

### Done Criteria
- `wrangler deploy --dry-run` 통과
- Worker가 static assets와 Queue binding을 동시에 가짐
- production 기준 primary path가 Worker로 문서화됨

---

## WP-2. Supabase Schema/Repository 보강

### 목표
- chunked scan의 상태 추적을 DB에서 원子的으로 처리한다.

### 작업
- `scan_runs`에 chunking 관련 컬럼 추가
- `scan_run_items` 저장 로직 보강
- chunk 완료 시 finalizer를 딱 한 번만 트리거하는 RPC 함수 추가

### 권장 migration
```sql
ALTER TABLE scan_runs ADD COLUMN IF NOT EXISTS market_region VARCHAR(10);
ALTER TABLE scan_runs ADD COLUMN IF NOT EXISTS chunk_size INTEGER;
ALTER TABLE scan_runs ADD COLUMN IF NOT EXISTS total_chunks INTEGER;
ALTER TABLE scan_runs ADD COLUMN IF NOT EXISTS completed_chunks INTEGER NOT NULL DEFAULT 0;
ALTER TABLE scan_runs ADD COLUMN IF NOT EXISTS failed_chunks INTEGER NOT NULL DEFAULT 0;
ALTER TABLE scan_runs ADD COLUMN IF NOT EXISTS meta JSONB NOT NULL DEFAULT '{}';
```

### RPC 함수 예시
```sql
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
```

### Repository 작업
- `scanRunRepository`
  - `createChunkedRun(...)`
  - `getById(runId)`
  - `recordChunk(...)`
- `scanRunItemRepository` 신규 또는 확장
  - `saveItems(items[])`

### Done Criteria
- scan run 생성 -> chunk N회 update -> finalizer boolean이 정확히 1번만 true
- 중복 finalization이 DB에서 원子的으로 차단됨
- `scan_run_items`가 실제로 저장됨

---

## WP-3. Scan Orchestrator 신규 구현

### 목표
- cron/manual/UI 트리거가 오면 **즉시 enqueue만 하고 끝나는 lightweight 경로**를 만든다.

### 신규 파일
- `src/engine/scanOrchestrator.ts`

### 핵심 책임
- market/slot 해석
  - `scheduled()`의 cron expression
  - `/api/v8/cron-scan` query/body
  - `/api/v8/scan/run` body
- closed market guard
- active watchlist 조회
- market별 ticker 분리
- chunking
  - US: 기본 2개/chunk
  - KR: 기본 3개/chunk
  - 필요 시 1개/chunk로 축소 가능
- `scan_runs` 생성
  - `status = 'RUNNING'`
  - `total_chunks`
  - `chunk_size`
  - `market_region`
- Queue message enqueue
  - 1 message = 1 chunk

### Queue message shape
```ts
interface ScanChunkMessage {
  scanRunId: string;
  market: 'US' | 'KR';
  tickers: string[];
  chunkIndex: number;
  totalChunks: number;
  slot: string;
  triggeredBy: string;
  sourceUrl?: string;
}
```

### 반드시 제거할 것
- production 경로에서 **seed fallback을 신호 생성으로 연결하는 흐름**
- orchestrator 단계에서 25초 timeout 후 전체 재시도 같은 heavy logic

### Done Criteria
- orchestrator는 HTTP handler 내에서 수십 ms 수준으로 끝남
- orchestrator는 전체 평가를 수행하지 않음
- watchlist가 비면 `SKIPPED_EMPTY_WATCHLIST` 상태로 종료되고 Telegram을 날리지 않음

---

## WP-4. Chunk Processor 구현

### 목표
- Queue consumer invocation당 **2~3개 ticker만** 평가하게 만든다.

### 신규/수정 파일
- `src/engine/scanChunkProcessor.ts`
- `src/pipeline/scanService.ts` 또는 `src/pipeline/scanChunkService.ts`

### 핵심 책임
- chunk ticker-only evaluation
- cache-first market data
- indicator/evaluation/signal 저장
- `scan_run_items` 저장
- `record_scan_chunk()` 호출

### chunk 처리 순서
1. `ensureDbConnected(env)`
2. chunk ticker list 검증
3. market data cache 확인
   - Supabase `market_data_daily`에 fresh bars가 있으면 재사용
   - 없거나 stale이면 Yahoo fetch
4. ticker별 evaluation
   - 기존 `evaluationService.evaluateTicker()` 재사용
5. batch save
   - `evaluationRepository.saveAll()`
   - `marketDataService.flushIndicators()`
   - `signalRepository.saveSignals()`
   - `scanRunItemRepository.saveItems()`
6. `record_scan_chunk()`
   - `SUCCESS` / `PARTIAL_SUCCESS` / `FAILED`
7. finalizer trigger boolean 반환

### budget guard
- chunk message에 ticker 수가 한도를 넘는다면 처리하지 않고 dead-letter 또는 error log로 보냄
- 기본 한도
  - US: 2
  - KR: 3
  - 전체: 3

### Done Criteria
- chunk invocation당 subrequest 예상치가 50 미만
- chunk invocation당 CPU가 Free plan 한도 안에 들어오는지 벤치마크로 확인
- chunk 실패가 다른 chunk에 연쇄 영향을 주지 않음

---

## WP-5. Finalizer 구현

### 목표
- 모든 chunk가 완료된 이후에만 스캔을 종결하고, Telegram을 **한 번만** 보낸다.

### 신규 파일
- `src/engine/scanFinalizer.ts`

### 핵심 책임
- `record_scan_chunk()`가 `true`를 반환한 chunk만 finalizer 수행
- `scan_runs` 상태 확인
- 최신 evaluations/signals/scan_run_items 조회
- Telegram report 생성
- `alert_notifications` 기록
- 중복 finalization 방지

### 기존 코드 재사용
- `src/engine/cronScanEngine.ts`
  - slot/market 해석
  - closed market guard
  - Telegram report text 생성 로직
  - strategy A/B summary
- 다만
  - scan 실행
  - seed fallback
  - 25초 timeout
  - direct DB log commit
  는 finalizer에서 분리하거나 제거

### 최종 report 구성
- strategy A signals
- strategy B dip opportunities
- exit signals
- partial failure summary
- data provenance summary
- dashboard URL

### Done Criteria
- finalizer는 scan 전체 완료 후 1회만 실행
- Telegram 중복 발송 없음
- partial failure가 report에 명시됨
- seed data 기반 report가 production에서 생성되지 않음

---

## WP-6. Worker Route 재배치

### 목표
- `worker.ts`가 Workers-only production entrypoint로 정리된다.

### 수정 대상
- `worker.ts`

### 변경 사항

#### 1) `/api/v8/scan/run`
- 현재: 전체 스캔 sync 실행
- 변경:
  - auth 확인
  - market validation
  - `scanOrchestrator.startScan()`
  - `202 { success: true, scan_id, status: 'RUNNING' }`

#### 2) `/api/v8/cron-scan`
- 현재: `executeCronScan()` sync 또는 waitUntil
- 변경:
  - external cron secret 확인
  - `scanOrchestrator.startScan()`
  - `202 { success: true, scan_id }`
- `async=true` 개념은 기본 동작이 아님
  - 원래부터 async chunking이기 때문

#### 3) `scheduled()`
- 현재: `executeCronScan()`
- 변경:
  - cron expression -> market/slot mapping
  - `scanOrchestrator.startScan()`
  - 전체 chunk 처리를 `scheduled()`에서 await하지 않음
  - enqueue만 하고 종료

#### 4) 신규 route
- `GET /api/v8/scan/status/:scanId`
- `GET /api/v8/scan/runs`
- 필요 시 `GET /api/v8/scan/budget`
  - 현재 chunk size, expected subrequest estimate

### legacy path 처리
- 기존 `executeCronScan()`
  - local dev 또는 rollback 전용으로 격리
  - env flag 예시:
    - `SCAN_MODE=chunked` (default)
    - `SCAN_MODE=legacy` (local/Paid 용)

### Done Criteria
- production worker에서 heavy scan sync 경로가 사라짐
- UI scan 버튼은 `scan_id`를 받고 status polling으로 진행 상황을 확인
- `scheduled()`가 한 invocation에서 전체 평가를 수행하지 않음

---

## WP-7. 보안 P0

### 목표
- Workers-only 공개 실행에서 privileged endpoint를 보호한다.

### 보호 대상
- `POST /api/v8/scan/run`
- `POST /api/v8/cron-scan`
- `POST /api/v8/schedule/trigger`
- `POST /api/v8/system/db/clear`
- `POST /api/v8/system/db/seed`
- `POST /api/v8/system/db/schema-sql`
- `POST /api/v8/telegram/test-broadcast`
- 가능하면 watchlist mutation도 보호

### 인증 방식
- Cloudflare secret/vars
  - `API_AUTH_TOKEN`
  - 기존 `CRON_SECRET_TOKEN`과 병합 또는 구분 가능
- request header
  - `Authorization: Bearer <token>`
  - 또는 `x-api-token: <token>`
- local dev
  - `.env` 기반 token 사용
  - 필요 시 `REQUIRE_API_AUTH=false`로만 완화

### 추가 조치
- Telegram token/chatId를 client body에서 받지 않도록 변경
  - `env`/Cloudflare secret에서만 공급
- `test-broadcast`도 auth 보호
- DB clear/seed/schema-sql은 반드시 auth

### Done Criteria
- token 없이는 privileged API 401/403
- token이 env에 없는 production 배포 시 privileged API fail-closed
- client side secret 입력 경로 제거 또는 비활성화

---

## WP-8. Data Cache-first / 신호 신뢰성 보강

### 목표
- 반복 스캔에서 불필요한 Yahoo fetch를 줄이고, seed fallback이 신호에 섞이지 않도록 한다.

### 작업
- `marketDataService` 또는 provider 계층에 cache-first 경로 추가
  - ticker별 `market_data_daily` 조회
  - fresh 기준 충족 시 DB bars 사용
  - fresh하지 않으면 Yahoo fetch 후 upsert
- fresh 기준
  - 시장별 trading day 기준
  - 최소 252 bars
  - latest bar date가 현재/전일 정규장 기준과 일치
- production scan에서
  - seed fallback으로 **신호 생성되는 경로 제거**
  - seed는 local dev/demo용으로만 제한

### Done Criteria
- 2회째 스캔에서 이미 fresh한 tickers는 Yahoo 재호출 0건
- production에서 `isFallback=true` 데이터로 신호가 생성되지 않음
- UI/로그에서 `DB stale / Yahoo fallback / seed mode`를 구분해서 볼 수 있음

---

## WP-9. UI/가시성 보강

### 목표
- 사용자가 “지금 스캔이 어떤 상태인지”를 바로 알 수 있게 한다.

### 작업
- scan 실행 후
  - `scan_id` 반환
  - progress polling
- dashboard에 표시
  - `RUNNING / PARTIAL_SUCCESS / SUCCESS / FAILED / SKIPPED`
  - `completed_chunks / total_chunks`
  - `evaluated_count`
  - `signal_count`
  - `failure_count`
  - data provenance 상태
- system status에 표시
  - `db_connected`
  - `scan_mode`
  - queue binding 존재 여부
  - fallback mode 여부

### Done Criteria
- UI에서 scan이 background로 넘어간 후 진행 상태를 확인할 수 있음
- fallback/disconnected 상태가 화면에서 즉시 인지됨

---

## WP-10. 테스트/검증

### 목표
- Workers-only Free 구조가 “돌긴 하는데 한도를 깨는” 상태가 되지 않도록 검증한다.

### unit tests
- chunking
  - 21 US tickers -> 2개 단위 chunks
  - 11 KR tickers -> 3개 단위 chunks
  - empty watchlist handling
- orchestrator
  - queue message shape
  - scan run creation
  - closed market skip
- chunk processor
  - cache-first path
  - yahoo fallback path
  - partial failure
  - record_scan_chunk 호출
- finalizer
  - idempotency
  - duplicate prevention
  - partial failure report
- auth
  - token missing
  - token mismatch
  - protected path matrix

### integration-style tests
- mock Supabase + mock Queue 환경에서
  - orchestrator -> chunk x N -> finalizer 순서
  - finalizer가 딱 한 번만 실행
- `record_scan_chunk()` behavior
  - completed + failed >= total
  - double finalization prevention

### production smoke test
- `wrangler dev` 또는 staging worker에서
  - KR 11 tickers
  - US 21 tickers
  - 반복 스캔
  - DB write 확인
  - Telegram 1회 발송 확인

### Done Criteria
- 기존 244개 테스트 전부 통과
- 신규 chunking/finalizer/auth tests 통과
- manual smoke test에서 subrequest 한도 초과 로그 없음

---

## 6. API Contract Change

### Before
- `POST /api/v8/scan/run`
  - sync 전체 스캔
  - 완료 후 결과 반환
- `POST /api/v8/cron-scan`
  - sync 또는 waitUntil 전체 스캔

### After
- `POST /api/v8/scan/run`
  - `202`
  - `{ success: true, scan_id: "...", status: "RUNNING" }`
- `POST /api/v8/cron-scan`
  - `202`
  - `{ success: true, scan_id: "...", status: "RUNNING" }`
- `GET /api/v8/scan/status/:scanId`
  - `{ status, completed_chunks, total_chunks, evaluated_count, signal_count, failure_count }`

### UI 영향
- scan 버튼 클릭 후 즉시 완료가 아니라
  - “스캔 시작됨”
  - progress polling
  - 완료 후 refresh

---

## 7. Free Plan Budget 가정

### orchestrator invocation
- watchlist read: 1
- scan run insert: 1
- queue send: 0 subrequest
- 합계: **약 2**

### chunk invocation
- 2 tickers 기준
  - DB read: 1~2
  - Yahoo fetch: 2~4
  - evaluation upsert: 1
  - indicator flush: 1
  - signal upsert: 0~1
  - scan_run_items insert: 1
  - RPC: 1
- 합계: **대체로 10~15 수준**

### finalizer invocation
- evaluations read: 1
- scan_run_items read: 1
- alert insert: 1
- telegram send: 1
- scan update: 이미 RPC에서 처리
- 합계: **약 4**

### 결론
- 한 invocation당 50 subrequest 한도에 여유
- 단, CPU는 chunk size를 줄여야 하는 변수이므로 **벤치마크 후 1~3개 사이에서 조정**

---

## 8. Rollout Plan

### Step 1. 문서/설정
- 이 계획 승인
- `wrangler.toml` queue binding 추가
- package scripts 추가

### Step 2. DB migration
- Supabase SQL Editor에 P0 migration 실행
- `record_scan_chunk()` 함수 확인

### Step 3. Worker 구현
- orchestrator/chunk/finalizer 추가
- `worker.ts` route 전환
- auth middleware 추가

### Step 4. Staging 테스트
- `SCAN_MODE=chunked`
- KR manual scan
- US manual scan
- DB write 확인
- Telegram 1회 발송 확인

### Step 5. Cron 전환
- 기존 4개 cron trigger 유지
- `scheduled()`를 orchestrator 기반 기준으로 전환
- 1~2일 동안 scan_runs/log 모니터링

### Step 6. Legacy path 정리
- `executeCronScan()` heavy path를 local-only 또는 rollback-only로 격리
- `functions/`를 legacy로 명시

### Rollback
- `SCAN_MODE=legacy`
  - local dev 또는 Paid 환경에서만 권장
- 또는 chunk size를 1로 축소
- queue consumer를 잠시 비활성화하고 orchestrator만 가동하여 상태 확인

---

## 9. Commit Plan

### Commit 1: Docs & Wrangler
- `docs/P0_WORKERS_ONLY_FREE_IMPLEMENTATION_PLAN.md`
- `wrangler.toml`
- `package.json`

### Commit 2: DB schema & repositories
- migration SQL
- `scanRunRepository`
- `scanRunItemRepository`
- tests

### Commit 3: Auth
- worker auth middleware
- protected path matrix
- tests

### Commit 4: Scan orchestrator
- `scanOrchestrator.ts`
- chunking logic
- tests

### Commit 5: Chunk processor & finalizer
- `scanChunkProcessor.ts`
- `scanFinalizer.ts`
- `record_scan_chunk()` integration
- tests

### Commit 6: Worker routes
- `/scan/run`
- `/cron-scan`
- `scheduled()`
- status routes
- tests

### Commit 7: UI/observability
- scan status polling
- fallback/provenance display
- system status

### Commit 8: Cache-first data path
- market data cache-first
- seed fallback production 차단
- tests

### Commit 9: Docs cleanup
- `CLOUDFLARE_DEPLOYMENT.md`
- `README.md`
- runtime decision update

---

## 10. Definition of Done

P0가 끝났다고 선언하려면 다음이 전부 만족되어야 한다:

- [ ] 별도 앱 서버 없이 Cloudflare Worker + Supabase만으로 전 경로 동작
- [ ] `worker.ts`가 production primary runtime
- [ ] `server.ts`는 local dev로만 사용
- [ ] US 전체 스캔이 한 invocation이 아니라 chunk 단위로 실행
- [ ] KR 전체 스캔도 chunk 단위로 실행
- [ ] `scheduled()`가 orchestrator만 호출하고 바로 종료
- [ ] finalizer가 scan 완료 후 정확히 1회만 실행
- [ ] Telegram이 scan 전체당 1회만 발송
- [ ] privileged API가 auth 없이 열리지 않음
- [ ] production에서 seed fallback 신호가 생성되지 않음
- [ ] UI에서 scan 진행 상태와 failure 상태를 확인할 수 있음
- [ ] `bun run lint`
- [ ] `bun run test`
- [ ] `wrangler deploy --dry-run`

---

## 11. 최종 요약

- **Workers-only는 가능하지만, 지금 코드 그대로는 Free plan에서 불안정하다**
- 따라서 P0의 핵심은:
  1. **runtime을 Worker로 단일화**
  2. **scan을 chunking/queue 기반으로 변환**
  3. **cache-first로 subrequest를 줄이기**
  4. **auth/finalizer/provenance를 보강**
- 이 4가지만 끝나면
  - 별도 서버 없이
  - Cloudflare Free 안에서
  - 스캔/스케줄링/알림/DB 전 주기를 운영할 수 있는 구조가 된다.
