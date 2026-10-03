# Cloudflare Pages / Workers Deployment Guide

This project can be deployed to **Cloudflare Pages** or **Cloudflare Workers**.

---

## 🚀 Option A: Cloudflare Pages (Recommended for Full-Stack / SPA)

### Method 1: Git Integration (GitHub / GitLab)
1. Export or push this repository to GitHub/GitLab.
2. In the [Cloudflare Dashboard](https://dash.cloudflare.com/), go to **Workers & Pages** > **Create application** > **Pages** > **Connect to Git**.
3. Select your repository and configure build settings:
   - **Framework preset**: `Vite`
   - **Build command**: `npm run build:pages` (or `npm run build`)
   - **Build output directory**: `dist`
   - **Node.js version**: `20` or higher (add Environment Variable `NODE_VERSION=20`)

### Method 2: Direct CLI Deployment (`wrangler`)
1. Authenticate with your Cloudflare account:
   ```bash
   npx wrangler login
   ```
2. Build the client bundle:
   ```bash
   npm run build:pages
   ```
3. Deploy directly to Cloudflare Pages:
   ```bash
   npx wrangler pages deploy dist --project-name quant-decision-engine
   ```

---

## ⚙️ Environment Variables on Cloudflare
Configure the following in **Pages > Settings > Environment Variables**:
- `TELEGRAM_BOT_TOKEN`: *(Recommended)* Telegram Bot token from `@BotFather`
- `TELEGRAM_CHAT_ID`: *(Recommended)* Your chat or channel ID from `@userinfobot`
- `CRON_SECRET_TOKEN`: *(Optional)* Secret token to protect the `/api/v8/cron-scan` endpoint
- `GEMINI_API_KEY`: *(Optional)* Your Google Gemini API Key
- `SUPABASE_URL`: *(Optional)* Your Supabase project URL
- `SUPABASE_KEY`: *(Optional)* Your Supabase public/service key
- `V8_DATA_PROVIDER`: `yahoo` (or `seed`)

---

## ⏰ Automated Scanning Schedule (4 Daily Runs - 국내장 2회 + 미국장 2회)

Cloudflare Workers의 `wrangler.toml`에 4개 트리거가 기본 등록되어 있습니다:

1. **06:30 KST (화~토) - 🌅 [미국장 마감] 종가 확정 브리핑**
   - Cron (UTC): `30 21 * * 1-5`
   - 전일 미국장 종가 기준 4대 팩터 최종 집계 및 일봉 확정 시그널 도출
2. **09:30 KST (월~금) - ☀️ [국내장 개장] 시초가 & 오전 기회종목 브리핑**
   - Cron (UTC): `30 0 * * 1-5`
   - KOSPI / KOSDAQ 시초가 형성 직후 갭상승 및 당일 급등/모멘텀 유망주 브리핑
3. **15:40 KST (월~금) - 🏁 [국내장 마감] 종가 확정 & 퀀트 리포트**
   - Cron (UTC): `40 6 * * 1-5`
   - 국내 정규장 일봉 종가 확정, 4대 팩터 종합 점수 집계 및 우량주 눌림목 추매 신호 발송
4. **23:00 KST (월~금) - 🌃 [미국장 개장] 개장 & 당일 관심종목 브리핑**
   - Cron (UTC): `0 14 * * 1-5`
   - 미국 본장 개장 직후 모멘텀 돌파 및 당일 유효 진입 후보군 압축

### 자동 실행 설정 방법 (2가지):
- **방법 1 (Cloudflare Workers Cron Triggers - 추천):** `wrangler.toml`의 `[triggers] crons` 설정에 따라 Cloudflare가 정해진 시각에 Worker의 `scheduled()`를 직접 깨워 100% 자동 실행 (추가 설정 불필요).
- **방법 2 (외부 Webhook):** [cron-job.org](https://cron-job.org) 또는 GitHub Actions에 `https://내서브도메인.pages.dev/api/v8/cron-scan?async=true` URL을 위 UTC 크론 표현식으로 등록 (예: 미국장 전용은 `&market=US`, 국내장 전용은 `&market=KR` 파라미터 추가 가능).

---

## ⚡ Cloudflare Subrequests 한도 관리 ("Too many subrequests" 방지)

### Free 플랜 서브리퀘스트 예산 (하드캡 50 / invocation)

무료 플랜 Worker는 1회 호출당 외부 `fetch` subrequest가 **최대 50개**로 고정됩니다.
**이 값은 설정으로 올릴 수 없습니다.** (아래 `[limits]` 참고)

현재 코드 기준 1회 스캔의 서브리퀘스트 구성:

| 호출 | 건수 | 비고 |
| --- | --- | --- |
| `getHistorical` (Yahoo/Naver) | 종목수 × 1~2 | ticker당 1회. `query1` 실패 시 `query2`로 재시도 → 2회 |
| `getQuote` | **0** | `getHistorical`이 채운 인메모리 캐시를 재사용 (`marketDataService.ts:140`) |
| `getFundamentals` | **0** | Yahoo 프로바이어는 시드 fallback으로 처리, 네트워크 미사용 |
| DB 쓰기 (평가/지표/시그널/스캔이력) | ~6~10 | 배치 upsert 적용 (`69ef499`) |
| Telegram 발송 | 1~2 | |

- **국내장 스캔 (11종목): 약 18~34건 — 안전**
- **미국장 스캔 (21종목): 약 28~54건 — 위험**
  Yahoo `query1`이 다수 종목에서 실패해 `query2`로 폴백하면 **50을 초과**합니다.

**시장 분리 스캔** (미국장 스캔 시 국내 종목 완전 배제, 그 반대) 은 이 예산 안에서 평가 종목 수를
절반으로 압축하기 위한 필수 전략입니다.

> ⚠️ 서브리퀘스트 한도는 **invocation(= 요청) 단위**로 누적됩니다.
> 핸들러 안에서 US → KR을 순차 실행해도 같은 요청 안이라 합산되므로 통합 스캔은 예산 안에서 불가능합니다.
> (워치리스트는 미장 21 + 국장 11 = **32종목**)
>
> 대신 `market`을 **필수**로 강제합니다:
>
> | 계층 | 처리 |
> | --- | --- |
> | `PipelineExecutionOptions.market` | 컴파일 타임 필수 필드 |
> | `scanService.executeScan` | `'US'`/`'KR'` 아니면 즉시 throw |
> | `POST /api/v8/scan/run` | market 누락·불명 시 `400` |
> | `POST /api/v8/cron-scan` (worker) | 동일하게 `400` |

### ⚠️ `[limits]` 는 Workers **Paid** 전용입니다

```toml
# ❌ Free 플랜에서 이 블록을 추가하면 wrangler deploy가 실패합니다.
[limits]
subrequests = 1000
```

- `limits`는 **Standard(유료) Usage Model 전용**입니다. Free 계정에서 `subrequests` 최대치는 **50이며 상향 자체가 불가능**합니다.
- wrangler는 클라이언트에서 타입 검증만 하고 **계정 플랜을 검증하지 않아서** `wrangler deploy --dry-run`은 통과합니다.
  실제 업로드 시 서버가 플랜 오류로 거부합니다.
- Paid 플랜으로 승격한 뒤에야 유효합니다.

### ⚠️ Free 플랜의 CPU 한도 (더 큰 제약)

무료 플랜 CPU 한도는 **HTTP 요청당 10ms, Cron Trigger당 10ms** 입니다. (Paid는 Cron당 30초~15분)

현재 크론 스캔은 종목당 252봉 기반 technical/momentum 지표 계산을 수행하므로
(KR 11종목 / US 21종목) 순수 계산량이 **10ms 예산에 근접하거나 초과**합니다.
커런 스캔이 `Error 1102 (Worker exceeded resource limits)`로 실패할 수 있습니다.

**Free 플랜을 유지하려면:** 크론 트리거를 Worker 내부는 비워두고, **계산은 외부(cron-job.org/GitHub Actions)에서 수행한 뒤
Supabase에 결과를 적재**하고, Worker는 읽기 전용 API로만 동작시키는 구조를 권장합니다.
이 경우 Worker CPU는 거의 0이 되어 Free 한도 내에서 안정적으로 동작합니다.

---

## 📦 Static SPA & Functions Routing
- `functions/api/`: Cloudflare Pages Functions가 자동으로 엣지 API 엔드포인트를 제공합니다.
- `public/_redirects`: 클라이언트 사이드 SPA 라우팅 새로고침 404를 방지합니다.

