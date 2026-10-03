# 프로젝트 최종 방향성 결정서

- 문서: `docs/PROJECT_DIRECTION_DECISION.md`
- 작성일: 2026-10-03
- 대상: `/home/dragon/v8qtengine`
- 기준 커밋: `e4d49e6 build: auto-inject git commit hash/message at build time`
- 상태: **확정 제안**
- 목적: 현재 프로젝트의 구현 상태, 쓸모, 향후 방향을 확정하고 이후 실행 우선순위를 고정하기 위함

---

## 1. Executive Decision

**결론: 프로젝트를 중단하지 않고 유지하되, 현재 목표와 범위를 “개인용 퀀트 의사결정·리서치 도구”로 축소하고 보안/신뢰성을 보강한다.**

### 최종 방향
- **Continue with scope reduction**
- **개인용 퀀트 대시보드 / 시그널 검증 도구**로 재정의
- **Cloudflare Workers/Pages Functions**를 production primary runtime으로 채택
- **Workers-only 구조**: 별도 앱 서버를 두지 않고, Cloudflare + Supabase만으로 UI/API/스캔/스케줄링을 운영
- **Free plan 우선**: 한 invocation당 heavy scan을 피하고, 스캔을 queue/chunk 단위로 분산 실행
- Node/Express(`server.ts`)는 **로컬 개발용**으로만 남겨 production primary path로 사용하지 않음
- **LLM/AI 멀티모델 오케스트레이션은 Phase 1에서 제외**
- **공개 프로덕션 서비스화 / 자율 트레이딩은 현재 상태에서는 Go-No**

### 한 줄 요약
> 이 프로젝트는 버릴 수준이 아니지만, 지금 그대로 확장하면 보안·데이터 신뢰성·배포 제약에서 조용히 깨질 가능성이 크다.  
> 따라서 먼저 **목표 축소 + Cloudflare Workers-only Free 구조화 + 신호 신뢰성 보강**을 완료한 뒤에야 확장 논의를 시작해야 한다.

---

## 2. 판단 근거: 현재 실제 상태

### 2.1. 확인된 기술 기준
- `bun run lint`: **통과**
- `bun run test`: **31개 테스트 파일, 244개 테스트 전부 통과**
- `bun run build`: **통과**
  - 단, 클라이언트 번들이 상당히 커 UI 성능/코드스플릿 개선 필요

이 사실은 다음을 의미한다:
- 코드 전체가 “동작하지 않는 상태”는 아님
- 다만 **테스트 통과 ≠ 투자 신호 신뢰성**
- 현재 테스트는 주로 단위 테스트 중심이며, end-to-end/통합 신뢰성 검증은 아직 부족함

---

### 2.2. 실제로 구현되어 있는 부분
- 시장 데이터 수집 → 정규화 → 기술/모멘텀/펀더멘털/밸류에이션 지표 계산
- 자산 분류 엔진
- 기회 점수 엔진
- 독립 리스크 엔진
- 의사결정 엔진
- 시그널 스냅샷/원장
- 백테스트 리플레이
- 스캔 실행/휴리스틱 폴백
- Supabase repository 패턴
- React UI
- 텔레그램 알림
- Cloudflare/Node 이중 배포 구조

즉, **프로토타입을 넘어 꽤 전진된 시스템**으로 평가된다.

---

### 2.3. “여러 모델”에 대한 핵심 판단
현재 repo에서 확인한 바:
- 소스에서 **Gemini/LLM 실제 호출 로직은 발견되지 않음**
- `@google/genai` 의존성과 `.env`의 Gemini 키만 존재
- 즉, **이 프로젝트는 현재 LLM 멀티모델 시스템이 아님**

반면 퀀트 관점에서는:
- 전략 타입 10종
  - ETF 6종
  - Equity 4종
- opportunity / risk / decision / signal / backtest / dip buy / risk sizing 등 다수 엔진 존재

따라서 다음 2가지 중 하나를 먼저 확정해야 한다:
1. **여러 모델 = 퀀트 전략/평가 모델**
   - 현재 코드와 방향이 일치함
2. **여러 모델 = LLM/AI 모델 ensemble**
   - 현재 코드는 그 목적에 맞게 구현되어 있지 않음

---

## 3. 핵심 리스크: 현재 상태의 진짜 문제들

### 3.1. 보안 리스크 — **P0**
- API 인증이 사실상 없음
- 스캔 실행, 텔레그램 설정, DB/시스템 관련 엔드포인트가 과도하게 열려 있음
- 공개 배포 시 제3자가 시스템 상태를 변경하거나 실행할 수 있는 구조
- `.env`는 현재 gitignore되어 있어 커밋된 상태는 아니지만, 로컬에 실제 secrets가 존재하는 것 자체가 운영 리스크

**판정: 공개 실행 전 반드시 해결해야 함**

---

### 3.2. 데이터/신호 신뢰성 리스크 — **P0~P1**
- seed/fallback 데이터가 신호 생성 경로에 충분히 차단되지 않을 수 있는 구조 존재
- `provenance` 또는 `isFallback` 플래그가 호출 측에 의존하는 설계
- 자산 분류가 하드코딩 티커 목록에 과도하게 의존
- 일부 계산 로직에서 경계값/엣지 케이스가 남아 있음
- live/backtest 간 입력 구성 정합성이 완전히 증명되지 않았음

**판정: “신호는 나오지만, 그 숫자를 완전히 믿기는 어려운 상태”**

---

### 3.3. 영속화/운영 리스크 — **P0~P1**
- Supabase 연동은 존재하지만 RLS/권한 문제로 **쓰기가 조용히 실패할 수 있음**
- 실패 시 in-memory fallback으로 넘어가므로 “동작하는 것처럼 보임”
- 이는 데모에는 유리하지만, 운영에는 매우 위험함
- 스키마/마이그레이션/레포지토리 간 정합성도 완전히 맞물려 있지 않음

**판정: 실제 영속화 여부를 UI/서버가 명확하게 보고해야 함**

---

### 3.4. 배포/러너 리스크 — **P0**
- `server.ts`(Node/Express)와 `worker.ts`(Cloudflare)가 병존
- functions, worker, server 간 route/state/config 분기 존재
- Cloudflare Free Plan 기준:
  - US 스캔 시 서브리퀘스트 예산에 근접하거나 초과 가능
  - Cron/Worker CPU 한도도 빠듯함
- 결과적으로 **동일 시스템이 두 런타임에서 다른 동작을 보이거나, 한쪽만 실제로 쓰는 상황이 발생하기 쉬움**

**판정: Workers-only + Free plan chunking을 기준으로 런타임과 스캔 구조를 고정해야 함**

---

### 3.5. 유지보수 리스크 — **P1**
- 일부 파일이 지나치게 큼
- DB client, engine, pipeline, API가 강결합
- route 중복 및 런타임 전용 분기 존재
- 확장성이 아니라 **수정 부하**가 빠르게 증가하는 구조

**판정: 지금 단계에서 기능 추가보다 구조 정리가 우선**

---

## 4. 프로젝트 쓸모 판단

### 4.1. 이 프로젝트에 있는 가치
- 개인 투자 판단 보조 도구
- 전략 실험을 위한 퀀트 랩
- 백테스트 기반 리서치 도구
- US/KR 시장 분리 스캔 개념
- 기회 점수와 리스크를 분리하는 구조
- 시그널 원장 + 사후 성과 추적 개념
- dashboard/API/notification으로 묶인 end-to-end 뼈대

따라서 **완전히 가치가 없는 프로젝트가 아님**

---

### 4.2. 아직 가치가 있다고 보기 어려운 부분
- 공개 서비스
- 자율 투자/트레이딩
- AI 멀티모델 의사결정 플랫폼
- “숫자를 바로 믿고 쓸 수 있는” 프로덕션 시그널 시스템

즉,
> **지금 이 프로젝트는 “연구/실험/보조 도구”로는 유효하지만, “프로덕션 의사결정 시스템”으로는 미성숙하다.**

---

## 5. 후보 방향과 평가

### Option A: 개인용 퀀트 대시보드 / 리서치 도구
- 현재 구현과 가장 잘 맞음
- 범위를 줄이고 신뢰성만 보강하면 실질적 가치 발생
- 실현 가능성: **높음**
- 리스크: **중간**
- 투자 비용: **상대적 최저**

**판정: 추천 (Workers-only / Cloudflare Free-first 기준)**

---

### Option B: 공개 프로덕션 서비스
- 인증, secret management, rate limiting, observability, SLA, 배포 버짓 등이 더 필요함
- 현재 리스크 수준에서는 공개 서비스화 부적합
- 실현 가능성: **중간**
- 리스크: **높음**
- 투자 비용: **대형**

**판정: 현재 상태에서는 No-Go**

---

### Option C: LLM/AI 멀티모델 의사결정 플랫폼
- 현재 코드는 LLM 오케스트레이션이 없음
- 기존 엔진은 팩터/시그널 공급자로만 재사용 가능
- 새로 모델 추상화, 결과 표준화, ensemble/consensus 설계가 필요
- 실현 가능성: **가능**
- 리스크: **높음**
- 투자 비용: **대형**

**판정: Phase 2 이후 후보. 지금은 시작하지 않음**

---

### Option D: 중단 / 방향 전환
- 코드 기반, 테스트, 대시보드, 백테스트 구조가 어느 정도 존재
- 완전 폐기할 만큼의 손실은 큼
- 하지만 “AI 멀티모델 플랫폼”을 전제로 한 기대를 그대로 유지하면 지속 유지보수 비용만 커짐

**판정: 중단보다 축소 재정렬이 합리적**

---

## 6. 최종 선택: Option A를 채택한다

### 최종 목표 정의
> 이 프로젝트의 목표는 **사용자가 개인적으로 사용할 수 있는 퀀트 시그널 검증·의사결정 보조 도구**이다.  
> 구체적으로는 다음 3가지를 안정적으로 제공하는 시스템으로 만든다:
> 1. 시장 데이터 기반 평가
> 2. 시그널 원장 및 사후 성과 추적
> 3. point-in-time 백테스트 검증

### 비목표 (현재 단계에서 하지 않음)
- 자율 주문/자동 트레이딩
- 공개 프로덕션 서비스
- LLM 멀티모델 기반 의사결정
- US+KR을 한 invocation에서 한꺼번에 실행하는 통합 대량 스캔
- 기능 확장 중심 개발

---

## 7. 목표 아키텍처

### 7.1. 런타임 결정
- **Primary runtime: Cloudflare Workers / Pages Functions**
  - production은 별도 앱 서버 없이 Cloudflare + Supabase 기준으로 구성
  - React UI는 Cloudflare Pages에서 정적 서빙
  - API/스캔/스케줄링은 Workers/Pages Functions에서 수행
- **Free plan 우선 설계**
  - 한 invocation에서 US 전체/대량 스캔을 몰아넣지 않음
  - 스캔은 queue/chunk 단위로 분산
  - Yahoo fetch와 Supabase write를 invocation당 한도 내에서 유지
- **Node/Express(`server.ts`): local development only**
  - 로컬 개발/디버깅에는 사용 가능
  - production target architecture에서는 primary가 아님

### 7.1.1 Workers-only Free 스캔 실행 모델
```text
Cloudflare Cron / UI Trigger
        |
POST /api/v8/cron-scan?market=US|KR
        |
Scan Orchestrator (lightweight)
  - scan run 생성
  - active watchlist chunking
  - queue enqueue
        |
Cloudflare Queue consumer (1 invocation = small chunk)
  - 2~3개 ticker만 fetch/evaluate
  - Supabase batch write
  - scan progress update
        |
Finalizer
  - all chunks complete check
  - scan run close
  - Telegram send once
```

#### Chunking rule
- **US**: 기본 2 ticker / chunk
- **KR**: 기본 3 ticker / chunk
- 필요 시 1 ticker / chunk로 축소 가능
- 한 chunk 안의 예상 subrequest:
  - Yahoo fetch: 2~4건
  - Supabase read/write: 2~4건
  - Telegram: finalizer에서만 1건
- 따라서 invocation당 50 subrequest budget에 여유를 두고 설계

#### Data cache rule
- Supabase `market_data_daily`를 primary cache로 사용
- 이미 당일 기준 fresh한 bars가 있으면 Yahoo 재호출을 생략
- 스캔 재실행 시에도 동일 invocation budget을 유지
- fundamentals는 현재처럼 네트워크 무관 seed/DB fallback 사용

#### Failure rule
- chunk 단위 retry
- 실패 ticker는 `scan_runs`에 기록하고 전체 스캔을 즉시 죽이지 않음
- final alert에 partial failure summary 포함

### 7.2. 계층 구조 목표
```text
Market Data Providers
        |
Data Quality / Provenance Gate
        |
Classification Engine
        |
Opportunity + Risk Engines
        |
Decision Engine
        |
Signal Ledger
        |
UI / Telegram / Persistence
```

### 7.3. 설계 원칙
- **평가 로직은 순수 함수 단일 소스**
  - live/backtest가 동일한 평가 코어 사용
- **데이터 출처는 always known**
  - fallback/seed/unknown은 원칙적으로 신호 대상에서 제외
- **실패는 숨기지 않음**
  - DB 쓰기 실패, fallback 사용, data staleness는 UI/로그에 명시
- **Workers-only production 구조**
  - production API/scan/scheduler는 Cloudflare 경로로 단일화
  - Node/Express는 local dev만 사용
  - worker/server 간 route duplication 축소
- **확장은 신뢰성 이후에**
  - paper trading, portfolio, macro, LLM 등은 Phase 2+

---

## 8. Scope 결정: 유지 / 보류 / 축소

### 8.1. 유지할 핵심 범위
- watchlist 관리
- ticker evaluation
- classification
- opportunity/risk scoring
- decision generation
- signal ledger
- backtest replay
- 기본 dashboard
- 기본 notification

### 8.2. 보류할 확장 범위
- paper trading
- portfolio optimization
- macro/earnings analysis
- risk sizing의 정교화
- LLM advisory
- 공개 API/멀티유저

### 8.3. 축소/통합할 부분
- `server.ts` / `worker.ts` / `functions/` 간 중복 route
- 데모용 seed fallback이 실데이터 경로처럼 보이는 UX
- Cloudflare Free 기준 무리한 통합/대량 스캔 경로
- 확장된 알림/설정 표가 프로덕션 설정처럼 보이는 부분

---

## 9. 실행 로드맵

## Phase 0: 결정 고정 (즉시)
### 목표
- 방향성, runtime, scope를 코드베이스 기준에서 고정

### 작업
- 이 문서 승인
- “주력 runtime = Cloudflare Workers/Pages Functions(Workers-only)” 확정
- Node/Express는 local dev용으로만 격리
- Free plan 기준 chunked scan 구조를 기본 설계로 채택
- 현재 feature freeze 범위 정의

### Done Criteria
- 팀(또는 본인)이 다음 문장을 동의함:
  - 이 프로젝트는 **개인용 퀀트 검증 도구**이다
  - **공개 프로덕션/자율 트레이딩/LLM 멀티모델은 Phase 1이 아니다**

---

## Phase 1: P0 안전성/신뢰성 보강
### 목표
- “조용히 깨지는 시스템”을 제거

### 1) 보안 보강
- API-level auth 도입
  - 최소한 shared secret/token-based guard
- 민감 endpoint 보호
  - scan execution
  - telegram config
  - db clear/seed/system
  - cron trigger
- client side에서 secret을 받는 경로 제거 또는 제한
- `.env` 기밀 파일 관리 유지 + secret leak 방지 관행화

### 2) Workers-only runtime 단일화
- Cloudflare Workers/Pages Functions를 production primary로 고정
- Node/Express는 local development용으로만 격리
- 현재처럼 한 invocation에서 전체 watchlist를 스캔하는 경로 제거
- orchestrator -> queue -> chunk worker -> finalizer 구조 도입
- Cloudflare Free 한도 기준 subrequest/CPU budget을 스캔 설계에 반영
- 중복 route 제거 또는 단일 공통 핸들러 추출

### 3) 데이터 신뢰성 게이트 강화
- `provenance`/`isFallback`을 **default deny**로 처리
- unknown/fallback/seed는 신호 생성 대상에서 원칙적으로 제외
- data quality score 미달 시 경고 노출
- UI에서 `DB disconnected / fallback mode`를 명확히 표시

### 4) DB/영속화 신뢰성
- RLS/권한 문제 점검 및 migration 재정리
- write success/failure를 명확히 기록
- 조용한 in-memory fallback을 “상태 정보”로 전면 노출
- 신호/평가/스캔 로그가 실제로 DB에 저장되었는지 확인할 수 있는 diagnostic 제공

### Done Criteria
- 인증 없는 privileged endpoint 0개
- fallback mode일 때 UI/로그에서 즉시 인지 가능
- DB write 실패가 조용히 사라지지 않음
- primary runtime 기준 단일 실행 경로 존재

---

## Phase 2: P1 모델/평가 신뢰성 보강
### 목표
- 신호 숫자 자체를 믿을 수 있게 만든다

### 1) 분류 엔진 개선
- 하드코딩 티커 의존 완화
- metadata-driven classification 보강
  - quoteType
  - sector
  - market cap
  - beta
  - volatility
  - revenue/growth characteristics
- unknown asset 처리를 명시
- 수동 override의 PIT 정합성 유지

### 2) 엔진 계산 보강
- PEG 계산 guard
- beta/drawdown boundary 조건 일관성 정리
- opportunity scoring의 missing fundamental 처리 명시화
- profit factor/expectancy 등 백테스트 지표 convention 문서화
- boundary value golden test 추가

### 3) live/backtest 정합성 검증
- 동일한 입력에서 live/backtest가 동일한 평가 결과를 보장하는 테스트
- point-in-time slicing 검증 강화
- classification/fundamentals/timestamp 기준 PIT 계약 테스트
- seed fallback이 백테스트 신호로 섞이지 않음 확인

### 4) 검증 데이터셋 확보
- 고정 시드 데이터 또는 fixture 기반 deterministic backtest
-golden fixture set:
  - US equity
  - KR equity
  - ETF
  - fallback data case
  - stale data case
- 기준 성과 지표:
  - 5D / 10D / 20D / 60D win rate
  - average return
  - MDD
  - profit factor
  - expectancy

### Done Criteria
- fixed input에 대한 deterministic output test 통과
- fallback/seed 데이터로 신호가 생성되지 않음
- live/backtest 핵심 입력 정합성 테스트 통과
- 백테스트 결과를 재현 가능하게 기록

---

## Phase 3: P2 검증/운영 성숙도
### 목표
- “도와봄” 수준이 아니라 “꾸준히 쓰는 도구”로 만듦

### 작업
- dashboard UX에서 신호 신뢰성 표시 강화
  - data source
  - data as-of
  - fallback status
  - db write status
- signal ledger의 사후 성과 추적 자동화
- alert notification의 중복/누락 제어
- basic observability
  - scan duration
  - subrequest count
  - error rate
  - db health
- Cloudflare Workers-only production 운영 체제 점검

### Done Criteria
- 사용자가 “지금 보이는 신호가 어떤 데이터/모드에서 나왔는지” 한눈에 판단 가능
- 정기 스캔 후에도 DB 상태와 신호 상태가 일치
- 운영 로그로 장애 원인 추적이 가능

---

## Phase 4: 이후 확장 후보 (선택)
아래 항목은 **Phase 1~3 완료 후**에만 논의한다.

1. **LLM Advisory Layer**
   - LLM은 절대 최종 의사결정자가 아니게
   - 역할:
     -.news/announcement 해석
     - 시그널에 대한 서술형 설명
     - 리스크 요인 요약
     - alternative view 제공
   - 설계:
     - rule-based engine output을 입력으로 받아 advisory만 생성
     - model output은 audit log에 기록
     - UI에서 “reference only”로 표시

2. **Multi-Market 확장**
   - US/KR 외에 다른 시장 추가
   - 단, 먼저 시장별 data source와 trading calendar 안정화 필요

3. **Portfolio / Position Sizing**
   - rule-based signal이 검증된 이후에만
   - 현재보다 data integrity가 더 중요

4. **Paper Trading**
   - signal ledger와 outcome tracking이 신뢰 가능할 때만
   - 지금 단계에서 paper trading은 신뢰성보다 기능이 앞서 나가는 항목

---

## 10. 리스크 레지스터

| 리스크 | 가능성 | 영향 | 대응 |
| --- | ---: | ---: | --- |
| 공개 API 무인증 악용 | 높음 | 높음 | Phase 1에서 auth 반드시 추가 |
| fallback 데이터가 신호에 섞임 | 중간 | 높음 | default deny provenance gate |
| DB write 조용 실패 | 중간 | 높음 | explicit write status + diagnostics |
| Cloudflare Free 한도 초과 | 높음 | 중간 | queue/chunked scan + Supabase cache + per-invocation budget guard |
| live/backtest 불일치 | 중간 | 높음 | shared evaluation core + PIT tests |
| 분류 오분류 | 중간 | 중간 | metadata-driven classification |
| 코드 중복으로 유지보수 악화 | 높음 | 중간 | runtime 단일화 |
| LLM 기대와 실제 구현 불일치 | 높음 | 중간 | Phase 1에서 LLM 목표 제외 |

---

## 11. Go / No-Go Gates

### Phase 2로 넘어가기 위한 Gate
- [ ] API auth가 실제 동작하고 bypass 없는지 확인
- [ ] primary runtime 단일화 완료
- [ ] fallback/seed 데이터가 신호에서 제외됨을 확인
- [ ] DB write 실패가 명확히 표시됨
- [ ] deterministic golden tests가 존재

### Phase 3로 넘어가기 위한 Gate
- [ ] classification 개선 및 unknown handling 명시
- [ ] engine edge case 보강
- [ ] live/backtest parity 테스트 통과
- [ ] 백테스트 fixture 재현성 확보
- [ ] UI에서 data provenance/status 확인 가능

### LLM 확장 착수 전 Gate
- [ ] rule-based signal 신뢰성 검증 완료
- [ ] signal ledger/audit log 안정화
- [ ] LLM output이 decision에 직접 관여하지 않는 계약 확정
- [ ] cost/latency/eval 기준 정의

---

## 12. 즉시 실행할 72시간 액션

### Day 1
- API auth middleware 추가
- privileged endpoint 보호
- `.env`/secret policy 재확인

### Day 2
- Cloudflare Workers/Pages Functions를 production primary runtime으로 공식화
- one-invocation heavy scan 경로를 비활성화하고 chunked scan 설계로 전환
- 중복 route 목록 정리

### Day 3
- provenance/fallback default deny 적용
- UI에 fallback/disconnected mode 표시
- golden fixture 1세트 추가

---

## 13. 최종 판단

### 이 프로젝트에 대한 최종 평가
- **기술적으로는 버릴 수준이 아님**
- **구조는 꽤 잘 잡혀 있음**
- **하지만 프로덕션 신뢰성은 아직 부족함**
- **현재 목표가 모호하면 구조가 계속 악화될 가능성이 큼**

### 따라서 최종 권고
1. **프로젝트 유지**
2. **목표를 개인용 퀀트 검증/의사결정 도구로 고정**
3. **Cloudflare Workers/Pages Functions를 Workers-only 주력 구조로 변경**
4. **보안과 데이터 신뢰성을 P0로 보강**
5. **LLM 멀티모델은 Phase 2 이후 후보로만 보존**

---

## 14. 부록: 이 결정의 핵심 근거
- lint/test/build가 모두 통과하는 살아있는 코드베이스
- core pipeline이 실제로 존재
- 그러나 인증, 영속화 신뢰성, 런타임 중복, Cloudflare 제약, 모델 정합성 문제가 동시 존재
- LLM 멀티모델과 관련된 실제 구현은 사실상 없음
- 결과적으로 “확장 우선”이 아니라 “축소 후 신뢰성 보강”이 정답
