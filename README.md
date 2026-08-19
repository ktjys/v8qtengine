# 🚀 V8 Quant Decision & Signal System (V8 퀀트 의사결정 및 시그널 시스템)

> **실시간 시장 데이터, 다차원 자산 분류, 기회-리스크 독립 평가 매트릭스, 불변 시그널 원장, Look-ahead Bias 제거 백테스트를 제공하는 차세대 퀀트 투자 의사결정 플랫폼**

---

## 📌 목차 (Table of Contents)
1. [프로젝트 개요 (Overview)](#1-프로젝트-개요-overview)
2. [시스템 핵심 철학 및 V7 대비 차별점](#2-시스템-핵심-철학-및-v7-대비-차별점)
3. [아키텍처 및 디렉토리 구조](#3-아키텍처-및-디렉토리-구조)
4. [주요 구현 기능 (Feature Breakdown)](#4-주요-구현-기능-feature-breakdown)
5. [설치 및 실행 방법 (Installation & Usage)](#5-설치-및-실행-방법-installation--usage)
6. [환경 변수 설정 (.env)](#6-환경-변수-설정-env)
7. [Supabase 데이터베이스 마이그레이션 가이드](#7-supabase-데이터베이스-마이그레이션-가이드)
8. [REST API 엔드포인트 명세](#8-rest-api-엔드포인트-명세)
9. [개발 로드맵 (Roadmap)](#9-개발-로드맵-roadmap)

---

## 1. 프로젝트 개요 (Overview)

**V8 Quant System**은 단일 지표나 고정 임계값에 의존하던 전통적인 기술적 분석(V7 방식)의 한계를 극복하고, 종목의 자산 특성(성장주, 가치주, 배당주, 지수 ETF, 레버리지 ETF 등)에 따라 가중치를 동적으로 적용하는 퀀트 의사결정 엔진입니다.

- **실시간 데이터 수집**: Yahoo Finance API 및 폴백 시드 데이터를 활용한 일봉(OHLCV) 및 재무 데이터 정규화 수집
- **영속적 데이터 관리**: Supabase(PostgreSQL) 기반 9개 테이블 스키마 및 Repository 패턴 적용
- **다차원 평가 모델**: 기회 점수(0~100)와 리스크 레벨(LOW/MEDIUM/HIGH)을 독립적으로 평가 후 최종 디시전 도출
- **엄밀한 백테스트**: 과거 시점 봉 슬라이싱(Point-in-Time)을 통해 미래 데이터 참조 편향(Look-ahead bias)을 완전히 차단한 전략 성과 검증
- **자동화 & 알림**: 일일 스캔 잡(Job Runner) 및 텔레그램 실시간 시그널 브로드캐스트 지원

---

## 2. 시스템 핵심 철학 및 V7 대비 차별점

| 비교 항목 | 기존 V7 전략 | 차세대 V8 전략 |
| :--- | :--- | :--- |
| **자산 분류 (Classification)** | 모든 종목을 동일한 기준으로 평가 | **7개 세부 전략 유형**으로 자동 분류 및 가중치 차등화 |
| **평가 로직 구조** | 단순 RSI / 이평선 결합 단일 점수 | **기회 점수(4개 팩터) vs 독립 리스크 평가 매트릭스** |
| **리스크 관리** | 점수 차감 방식으로 위험 희석 | **독립 게이트웨이**(고위험 시 기회점수가 높아도 매수 차단) |
| **데이터 영속성** | 메모리 배열(서버 재부팅 시 초기화) | **Supabase DB 영속화 (Repository 패턴)** |
| **백테스트 정밀도** | 단순 정적 산출식 | **Point-in-Time 과거 시점 재실행 (편향 제로)** |
| **시그널 라이프사이클** | 단발성 알림 | **불변 시그널 스냅샷 원장 + 5D/10D/20D 사후 성과 추적** |

---

## 3. 아키텍처 및 디렉토리 구조

```text
v8qtengine/
├── server.ts                       # 모듈화된 Express API 컨트롤러 및 엔트리포인트
├── package.json                    # 프로젝트 의존성 및 빌드 스크립트
├── .env.example                    # 환경변수 템플릿
├── supabase/
│   └── migrations/                 # 9개 PostgreSQL 테이블 마이그레이션 SQL
│       ├── 001_create_assets.sql
│       ├── 002_create_watchlist.sql
│       ├── 003_create_market_data_daily.sql
│       ├── 004_create_fundamentals.sql
│       ├── 005_create_indicator_snapshots.sql
│       ├── 006_create_evaluations.sql
│       ├── 007_create_signals.sql
│       ├── 008_create_signal_outcomes.sql
│       └── 009_create_scan_runs.sql
└── src/
    ├── types/                      # V8 통합 TypeScript 타입 정의 (v8.ts)
    ├── api/                        # 도메인별 REST API 라우터
    │   ├── evaluationRoutes.ts     # 종목 평가 조회 API
    │   ├── watchlistRoutes.ts      # 관심종목 CRUD API
    │   ├── classificationRoutes.ts # 자산분류 수동 오버라이드 API
    │   ├── scanRoutes.ts           # 유니버스 스캔 실행 API
    │   ├── signalRoutes.ts         # 시그널 원장 및 사후 수익률 API
    │   ├── backtestRoutes.ts       # V7 vs V8 백테스트 리플레이 API
    │   ├── runRoutes.ts            # 스캔 히스토리 API
    │   ├── systemRoutes.ts         # 시스템/프로바이더 상태 API
    │   └── telegramRoutes.ts       # 텔레그램 연동 및 테스트 발송 API
    ├── pipeline/                   # V8 비즈니스 실행 파이프라인
    │   ├── evaluationService.ts    # 단일 종목 평가 서비스
    │   ├── scanService.ts          # 유니버스 배치 스캔 및 장애 허용 처리
    │   └── v8Pipeline.ts           # 전체 파이프라인 인터페이스
    ├── engine/                     # V8 코어 계산 엔진
    │   ├── classificationEngine.ts # 자산 분류기
    │   ├── opportunityEngine.ts    # 기회 점수 계산기 (가중치 적용)
    │   ├── riskEngine.ts           # 독립 리스크 산출기
    │   ├── decisionEngine.ts       # 디시전 매트릭스 도출기
    │   ├── signalEngine.ts         # 시그널 스냅샷 생성 및 알림 포맷터
    │   └── backtestEngine.ts       # 백테스트 지표 계산기
    ├── data/                       # 데이터 수집 및 지표 계산 계층
    │   ├── marketDataService.ts    # 시장 데이터 수집 & 정규화 오케스트레이터
    │   ├── dataQualityValidator.ts # 데이터 정합성 & 신선도 검증기
    │   ├── providers/              # Yahoo / Seed 프로바이더
    │   ├── indicators/             # 기술적/모멘텀/펀더멘털 지표 계산기
    │   └── seed/                   # 초기 시드 픽스처 데이터
    ├── db/                         # 데이터베이스 계층 (Supabase & Repository)
    │   ├── supabaseClient.ts       # Supabase 클라이언트 및 로컬 캐시 폴백
    │   └── repositories/           # 8개 도메인별 Repository
    ├── backtest/                   # 과거 시점 리플레이 백테스트 엔진
    │   ├── historicalDataProvider.ts # Point-in-Time 슬라이싱
    │   ├── v7Strategy.ts           # 레거시 V7 전략 실행기
    │   ├── v8Strategy.ts           # V8 전략 실행기
    │   ├── performanceCalculator.ts# 승률, 기대값, Profit Factor 산출
    │   └── strategyReplay.ts       # 히스토리컬 일자별 리플레이 루프
    ├── notification/               # 텔레그램 브로드캐스트
    │   ├── templates.ts            # 실시간 시그널 알림 템플릿
    │   ├── telegramNotifier.ts     # 텔레그램 봇 전송 클라이언트
    │   └── notificationService.ts  # 알림 서비스
    ├── jobs/                       # 자동화 배치 작업
    │   ├── dailyMarketSync.ts      # 일일 시장 데이터 동기화
    │   ├── dailyScan.ts            # 일일 V8 스캔 & 시그널 생성
    │   ├── signalOutcomeUpdater.ts # 사후 5D/10D/20D 수익률 갱신
    │   └── jobRunner.ts            # 전체 자동화 사이클 실행기
    └── components/                 # React UI 대시보드 컴포넌트
```

---

## 4. 주요 구현 기능 (Feature Breakdown)

### ① 자산 분류 엔진 (`classificationEngine.ts`)
티커의 변동성, 베타(Beta), 시가총액, 섹터, ETF 유형에 따라 **7가지 전략 유형**으로 자동 분류합니다.
- `large_cap_growth`: 대형 성장주 (NVDA, AAPL 등 - 모멘텀 & 기술적 지표 중심)
- `large_cap_value`: 대형 가치주 (JNJ, PG 등 - 펀더멘털 & 밸류에이션 중심)
- `broad_index_etf`: 지수 ETF (SPY, QQQ 등 - 추세 추종 & 하락 방어)
- `high_beta_growth`: 고베타 성장주 (TSLA, AMD 등 - 변동성 관리)
- `dividend_defensive`: 배당/방어주 (KO, SCHD 등 - 안정적 배당 & 밸류)
- `crypto_proxy`: 가상자산 프록시/레버리지 (COIN, MSTR 등 - 초단기 모멘텀)
- `general_equity`: 일반 주식

> 🛡️ **수동 지정 보호**: 관리자가 특정 종목의 전략 유형을 수동 오버라이드하면, 자동 분류 로직이 덮어쓰지 않고 영구 보존됩니다.

### ② 기회-리스크 독립 매트릭스 (`opportunityEngine` & `riskEngine`)
- **기회 점수 (0~100점)**: 기술적 지표(30%), 모멘텀(30%), 펀더멘털(25%), 밸류에이션(15%)의 4가지 서브 스코어를 자산군 가중치에 맞춰 산출.
- **리스크 레벨 (LOW / MEDIUM / HIGH)**: 52주 고점 대비 낙폭(MDD), 20일 역사적 변동성, 200일 이평선 하회 여부, 베타값을 독립 분석.
- **의사결정 도출 (`decisionEngine`)**:
  - `STRONG_BUY`: 기회 점수 80점 이상 & LOW 리스크
  - `BUY`: 기회 점수 70점 이상 & LOW/MEDIUM 리스크
  - `WATCH`: 기회 점수 60~69점 또는 점수가 높아도 HIGH 리스크인 경우
  - `AVOID`: 기회 점수 60점 미만
  - `STOP_LOSS`: 200일선 붕괴 및 과도한 낙폭 발생 시

### ③ 무결성 백테스트 리플레이 (`src/backtest/`)
- **Point-in-Time Slicing**: $T$ 시점의 전략 판단 시 $T$ 시점까지의 일봉(`bars.slice(0, T + 1)`)만 주입하여 미래 데이터를 절대 볼 수 없도록 보장.
- **성과 지표 완전 산출**: 5일 / 10일 / 20일 승률(Win Rate), 평균 수익률, 중위 수익률, MDD(최대 낙폭), Profit Factor(총이익/총손실), 수학적 기대값(Expectancy) 산출.
- **전략 유형 및 리스크 구간별 성과 분해**: 어떤 자산군과 리스크 등급에서 초과 수익이 발생하는지 입체 분석.

### ④ 장애 허용 유니버스 스캔 (`scanService.ts`)
- 감시종목 리스트 중 1~2개 종목의 시세 수집이 타임아웃/실패하더라도 전체 스캔 프로세스가 중단되지 않고, 실패 항목을 로깅한 뒤 정상 종목 평가를 지속 완료합니다.

---

## 5. 설치 및 실행 방법 (Installation & Usage)

### 1) 요구 사항
- **Node.js**: v18.0.0 이상 (v20+ 권장)
- **npm** 또는 **yarn**

### 2) 설치
```bash
# 1. 저장소 클론
git clone https://github.com/ktjys/v8qtengine.git
cd v8qtengine

# 2. 의존성 패키지 설치
npm install
```

### 3) 환경 변수 파일 생성
```bash
cp .env.example .env
```
필요한 설정값(`.env`)을 수정합니다 (아래 6번 항목 참조).

### 4) 개발 모드 실행
```bash
npm run dev
```
브라우저에서 `http://localhost:3000`으로 접속하여 V8 Quant Dashboard를 확인할 수 있습니다.

### 5) 프로덕션 빌드 및 실행
```bash
# Vite 클라이언트 빌드 & esbuild 서버 번들링
npm run build

# 프로덕션 서버 실행 (dist/server.cjs)
npm start
```

---

## 6. 환경 변수 설정 (.env)

`.env` 파일에 다음 항목들을 설정할 수 있습니다.

```env
# 데이터 소스 프로바이더 설정 ('yahoo' 권장, 테스트 시 'seed')
V8_DATA_PROVIDER="yahoo"

# Supabase 클라우드 데이터베이스 연동 (설정 시 영구 DB 저장, 미설정 시 로컬 메모리 폴백)
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_KEY="your-supabase-service-role-or-anon-key"

# 텔레그램 실시간 시그널 봇 알림 설정 (선택 사항)
TELEGRAM_BOT_TOKEN="123456789:ABCdefGhIJKlmNoPQRstuVWXyz"
TELEGRAM_CHAT_ID="-1001234567890"

# Gemini AI 분석용 키 (선택 사항)
GEMINI_API_KEY=""
```

---

## 7. Supabase 데이터베이스 마이그레이션 가이드

Supabase 대시보드의 **SQL Editor**에 접속하여 `supabase/migrations/` 폴더 내의 SQL 스크립트를 순서대로 실행합니다:

1. `001_create_assets.sql` : 마스터 자산 테이블
2. `002_create_watchlist.sql` : 관심 감시종목 테이블
3. `003_create_market_data_daily.sql` : 일봉 시세(OHLCV) 테이블
4. `004_create_fundamentals.sql` : 재무제표 팩터 테이블
5. `005_create_indicator_snapshots.sql` : 기술적/모멘텀 지표 스냅샷
6. `006_create_evaluations.sql` : 실시간 평가 결과 테이블
7. `007_create_signals.sql` : 불변 퀀트 시그널 원장
8. `008_create_signal_outcomes.sql` : 사후 5D/10D/20D 수익률 추적 테이블
9. `009_create_scan_runs.sql` : 스캔 실행 이력 및 장애 로그 테이블

---

## 8. REST API 엔드포인트 명세

| Method | Endpoint | 설명 |
| :--- | :--- | :--- |
| **GET** | `/api/health` | 시스템 상태 및 엔진 버전 확인 |
| **GET** | `/api/v8/evaluations` | 전체 감시종목의 최신 V8 평가 결과 리스트 조회 |
| **GET** | `/api/v8/evaluations/:ticker` | 특정 종목의 V8 상세 평가 결과 조회 |
| **GET** | `/api/v8/watchlist` | 등록된 관심종목 전체 목록 조회 |
| **POST** | `/api/v8/watchlist` | 관심종목 신규 등록 및 즉시 평가 |
| **PATCH** | `/api/v8/watchlist/:ticker` | 관심종목 활성화/비활성화 및 메모 수정 |
| **DELETE**| `/api/v8/watchlist/:ticker` | 관심종목 삭제 |
| **POST** | `/api/v8/classification/override` | 자산 분류 및 전략 유형 수동 지정 (Manual Override) |
| **DELETE**| `/api/v8/classification/override/:ticker` | 자산 분류 수동 지정을 해제하고 자동 분류로 복귀 |
| **POST** | `/api/v8/scan/run` | 전체 유니버스 V8 평가 스캔 실행 (장애 허용 지원) |
| **GET** | `/api/v8/signals` | 불변 시그널 원장 및 사후 수익률 목록 조회 |
| **POST** | `/api/v8/signals/update-outcomes` | 시그널들의 사후 5D/10D/20D 수익률 최신화 |
| **GET** | `/api/v8/backtest/compare` | V7 vs V8 전략의 과거 시점 백테스트 비교 결과 조회 |
| **POST** | `/api/v8/backtest/replay` | 사용자 지정 기간/임계값 기반 과거 시점 리플레이 실행 |
| **GET** | `/api/v8/runs` | 과거 스캔 실행 이력 및 에러 로그 조회 |
| **GET** | `/api/v8/system/status` | DB 연결 상태, 프로바이더, 메모리/업타임 상태 조회 |
| **POST** | `/api/v8/system/provider` | 활성 데이터 소스 변경 (`yahoo` ↔ `seed`) |
| **POST** | `/api/v8/telegram/test-broadcast` | 텔레그램 시그널 알림 테스트 발송 |

---

## 9. 개발 로드맵 (Roadmap)

- [x] **P0: Market Data & Normalization** - Yahoo Finance & Seed 프로바이더 및 지표 계산기
- [x] **P0: Core Engine** - 7개 자산분류, 4개 기회 팩터, 독립 리스크 매트릭스, 디시전 도출
- [x] **P0: Database Persistence** - 9개 테이블 Supabase SQL 설계 및 Repository 패턴 구축
- [x] **P0: Backtest Replay Engine** - Look-ahead bias 없는 Point-in-Time 과거 리플레이 구현
- [x] **P0: Signal Ledger** - 불변 스냅샷 원장 및 사후 5D/10D/20D 수익률 라이프사이클
- [x] **P1: Job Scheduler & Automation** - 일일 시장 동기화 및 자동 스캔 배치 잡
- [x] **P1: Telegram Notification** - 실시간 시그널 알림 및 템플릿 포맷터
- [ ] **P2: Portfolio Sizing Optimization** - 리스크 레벨 및 켈리 공식 기반 동적 포지션 사이징 모델 추가
- [ ] **P2: Multi-Asset Expansion** - 한국 주식(KRX) 및 글로벌 원자재/외환 데이터 소스 확장
- [ ] **P2: Custom Webhook Alert** - 디스코드(Discord) 및 슬랙(Slack) 웹훅 알림 채널 추가

---

### 📄 라이선스 (License)
This project is licensed under the MIT License.
