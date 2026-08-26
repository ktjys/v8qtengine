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

## ⏰ Automated Scanning Schedule (3 Daily Runs)

The backend `/api/v8/cron-scan` endpoint automatically evaluates the quant decision engine and broadcasts Telegram alerts:

1. **06:30 KST (화~토) - 미국 정규장 마감 브리핑**
   - Cron (UTC): `30 21 * * 1-5`
   - 전일 종가 기준 4대 팩터(기술/모멘텀/펀더/밸류) 최종 집계 및 일봉 확정 시그널 도출
2. **22:00 KST (월~금) - 프리마켓 갭 분석 & 관심종목 압축**
   - Cron (UTC): `00 13 * * 1-5`
   - 당일 장전 진입 유효 후보군 압축 및 포트폴리오 비중 브리핑
3. **02:00 KST (화~토) - 장중 급변 & 모멘텀 브레이크아웃 감시**
   - Cron (UTC): `00 17 * * 1-5`
   - 장중 거래량 폭증 및 변동성 브레이크아웃 급변 종목 포착 시 실시간 알림

### 무료 자동 실행 설정 방법 (2가지):
- **방법 1 (무료 Webhook):** [cron-job.org](https://cron-job.org)에 가입 후 `https://내서브도메인.pages.dev/api/v8/cron-scan` URL을 등록하고 위 시각으로 설정.
- **방법 2 (대시보드 즉시 실행):** 상단 네비게이션 바의 **[자동 알림]** ➡️ **[지금 실행하기]** 버튼 클릭.

---

## 📦 Static SPA & Functions Routing
- `functions/api/`: Cloudflare Pages Functions가 자동으로 엣지 API 엔드포인트를 제공합니다.
- `public/_redirects`: 클라이언트 사이드 SPA 라우팅 새로고침 404를 방지합니다.
