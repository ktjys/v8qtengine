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
Configure the following in **Settings > Environment Variables** on Cloudflare Pages:
- `GEMINI_API_KEY`: *(Optional)* Your Google Gemini API Key
- `SUPABASE_URL`: *(Optional)* Your Supabase project URL
- `SUPABASE_KEY`: *(Optional)* Your Supabase public/service key
- `TELEGRAM_BOT_TOKEN`: *(Optional)* For real-time signal broadcasts
- `TELEGRAM_CHAT_ID`: *(Optional)* Telegram chat / channel ID
- `V8_DATA_PROVIDER`: `yahoo` (or `seed`)

---

## 📦 Static SPA Routing
The `_redirects` file in `public/_redirects` ensures client-side routing (single-page application) redirects all non-asset requests to `index.html`.
