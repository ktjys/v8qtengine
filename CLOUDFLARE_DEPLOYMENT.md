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
- **방법 2 (외부 Webhook):** [cron-job.org](https://cron-job.org) 또는 GitHub Actions에 `https://내서브도메인.pages.dev/api/v8/cron-scan?async=true` URL을 위 UTC 크론 표현식으로 등록.

---

## 📦 Static SPA & Functions Routing
- `functions/api/`: Cloudflare Pages Functions가 자동으로 엣지 API 엔드포인트를 제공합니다.
- `public/_redirects`: 클라이언트 사이드 SPA 라우팅 새로고침 404를 방지합니다.
