# V8QTEngine — Phase 0: 기준선 확보 (Baseline)

작성일: 2026-08-28
대상: ktjys/v8qtengine
작성자: Sisyphus (Red Team Pipeline)

> 이 문서는 수정 작업 전의 현재 상태를 고정한 기준선이다.
> 이후 각 Phase의 변경 전/후 비교의 기준으로 사용한다.

---

## 1. Build / Test 기준

| 항목 | 상태 | 비고 |
| :--- | :--- | :--- |
| Lint (`bun run lint` → `tsc --noEmit`) | ✅ PASS (exit 0) | 타입 에러 없음 |
| Build (`bun run build` → vite + esbuild) | ✅ PASS (exit 0) | server.cjs 233.5kb, client js 1,060.31 kB (gzip 290.10 kB) |
| Unit Test | ❌ 없음 | 테스트 파일(`*.test.ts`/`*.spec.ts`) 존재하지 않음 |
| Test runner | ❌ 없음 | package.json에 test script 없음 |

> ⚠️ **테스트 인프라가 전무하다.** 각 Phase별 완료 테스트(플랜 21장)를 수행하려면
> 이후에 테스트 러너(vitest 등) 도입이 필요하다.

---

## 2. Git 기준

- 브랜치: `main`
- 최근 커밋: `efda352 feat(signals): implement signal deduplication and fallback`
- 태그: 없음
- 작업 시작 시점 working tree: `bun.lock` modified, 나머지 untracked(`.omo/`, `.sisyphus/`)

---

## 3. DB Migration 상태

`supabase/migrations/` 에 4개 파일만 존재 (README에 명시된 9개 아님):

| 파일 | 용도 |
| :--- | :--- |
| `001_assets.sql` | 마스터 자산 |
| `002_market_data.sql` | 일봉 시세 OHLCV |
| `003_fundamentals.sql` | 재무 팩터 |
| `006_signals.sql` | signals + signal_outcomes + scan_runs (한 파일에 합침) |

- `.env` 없음 → **Supabase 미연결**. 현재 `marketDataRepository` 등은 미연결 시 로컬/빈 응답 처리할 것으로 추정 (확인 필요).

### 신호 스키마 한계 (Phase 4/5 관련)
`signals` 테이블:
- `signal_date DATE` — **timestamp 아님** (동일 날짜 다중 평가 구분 불가)
- `data_quality`, `data_asof`, `classification_confidence`, `engine_version` **없음**
- `signal_price` 없이 `entry_price`만 존재

`signal_outcomes`:
- `exit_date_5d` 등 exit 날짜 **없음**
- `avg/median/profit_factor` 등 성과는 별도 계산

---

## 4. 데이터 소스 기준

- `.env` 없음. 기본 프로바이더 = `yahoo` (V8_DATA_PROVIDER 미설정 시).
- **Seed 폴백 이슈 (Phase 2 관련)**:
  - `marketDataService.processBatch()` 의 catch 블록이 실패 시 **Seed로 대체** 후 평가 계속 (line 254~299)
  - 이는 "Yahoo 실패 → Seed → BUY" 경로 위험
- **Seed provider가 `Math.random()` 사용** → 같은 티커도 호출마다 다른 합성 바 생성.
  → **동일 입력 → 동일 출력 미보장** (Phase 1의 deterministic 요구와 상충)

---

## 5. 평가 아키텍처 기준 (Phase 1 관련 — LIVE vs BACKTEST)

현재 **LIVE와 BACKTEST가 동일한 하위 엔진**(opportunityEngine/riskEngine/decisionEngine)을
공유하지만 **입력을 구성하는 방식이 분리**되어 있다:

- **LIVE**: `marketDataService.processTicker()` → 실제 quote/fundamental/marketCap으로
  `RawMarketIndicators` + `RawRiskInputs` 구성 → `evaluateTicker()`
- **BACKTEST**: `quantStrategy.evaluateStrategy()` / `v8Strategy.evaluateV8Strategy()`
  → **하드코딩** `marketCap: 50_000_000_000`, **fundamental 미사용**으로 입력 구성

- **중복 함수**: `quantStrategy.ts`의 `evaluateStrategy`와 `v8Strategy.ts`의
  `evaluateV8Strategy`가 사실상 동일 로직으로 **두 파일에 중복 존재**.

- `makeDecision()`의 `signalConfidence` 등은 `classification.confidence`에 의존하는데,
  백테스트 경로에서는 `classifyAsset(ticker, {beta, marketCap: 50B})`로 분류하므로
  **Live에서의 실제 분류와 다를 수 있음**.

---

## 6. 백테스트 기준

- `strategyReplay.runHistoricalReplay()`: watchlist 기반, Opportunity threshold 기본 70.
- `historicalDataProvider`: DB → Yahoo → Seed 순서로 데이터 획득.
- Point-in-Time 슬라이싱: `getPointInTimeSlice(bars, i)` → `bars.slice(0, i+1)` ✓ (기본적으로 look-ahead 차단).
- **기준선 Backtest 수치: 미실행** (네트워크/Yahoo 의존, watchlist 비어있을 수 있어 재현 불확실).
  → 이후 Phase에서 seed 기반 결정적 백테스트 확보가 필요.

---

## 7. 성능 지표 정의 기준 (Phase 5/6 관련 — 현재의 한계)

- `return_5d/10d/20d`: `getForwardOutcomes()`에서 **trading day 기준** +5/+10/+20 봉 사용 ✓
- `max_drawdown`: 아래 방향만(entry→low) 계산 (`getForwardOutcomes`의 forwardWindow 최저가 기준)
  - 단, `performanceCalculator`의 `max_drawdown`은 **신호별 최저가** 취합이라 portfolio MDD와 다름.
- **미완료 Outcome 배제**: 5D/10D/20D 각각 `return_XXd !== null`로 필터링하여 계산 ✓ (부분적으로 준수)
- **Median**: `performanceCalculator` 짝수 중앙값 = `sorted[floor(n/2)]` — **플랜의 "짝수 개일 때 중앙 두 값 평균"과 상이** (Phase 6 개선 대상)

---

## 8. 기록 시점 판단 요약

| Phase 관련 | 현 상태 |
| :--- | :--- |
| Phase 1 (evaluateV8 단일화) | ❌ LIVE/BACKTEST 입력 구성 분리됨, 중복 eval 함수 존재 |
| Phase 2 (Data Quality Gate) | ❌ Seed fallback이 평가로 이어짐 |
| Phase 3 (PIT 계약) | ⚠️ 백테스트는 slice로 PIT 준수하나 DB `available_at` 개념 없음 |
| Phase 4 (Signal Snapshot) | ❌ `signal_date DATE`만, 필수 스냅샷 필드 부족 |
| Phase 5 (Outcome) | ⚠️ trading day는 준수, exit_date/median 개선 필요 |
| Phase 6 (Signal Backtest) | ⚠️ 통계 계산 존재하나 결정적 입력·median 보정 필요 |
