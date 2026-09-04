import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { evaluationRouter } from './src/api/evaluationRoutes';
import { watchlistRouter } from './src/api/watchlistRoutes';
import { classificationRouter } from './src/api/classificationRoutes';
import { scanRouter } from './src/api/scanRoutes';
import { signalRouter } from './src/api/signalRoutes';
import { backtestRouter } from './src/api/backtestRoutes';
import { runRouter } from './src/api/runRoutes';
import { systemRouter } from './src/api/systemRoutes';
import { telegramRouter } from './src/api/telegramRoutes';
import { executeCronScan, getLastCronScanResult } from './src/engine/cronScanEngine';
import { telegramNotifier } from './src/notification/telegramNotifier';
import { internalScheduler } from './src/services/internalScheduler';
import { getInitialOrLatestEvaluations } from './src/pipeline/v8Pipeline';
import { evaluationRepository } from './src/db/repositories/evaluationRepository';
import { createSignalSnapshot } from './src/engine/signalEngine';
import { buildSignalTelegramMessage } from './src/notification/templates';

function createRateLimiter(windowMs: number, max: number) {
  const hits = new Map<string, number[]>();
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, timestamps] of hits) {
      const valid = timestamps.filter((t) => now - t < windowMs);
      if (valid.length === 0) hits.delete(key);
      else hits.set(key, valid);
    }
  }, windowMs);
  if (cleanup.unref) cleanup.unref();

  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const timestamps = (hits.get(key) || []).filter((t) => now - t < windowMs);
    if (timestamps.length >= max) {
      res.status(429).json({ error: 'Too many requests. Please try again later.' });
      return;
    }
    timestamps.push(now);
    hits.set(key, timestamps);
    next();
  };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));
  app.use(createRateLimiter(60_000, 120));
  app.use('/api/v8/system', createRateLimiter(60_000, 30));
  app.use('/api/v8/scan', createRateLimiter(60_000, 10));

  // 1. Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  });

  // 2. Mount Modular Routers
  app.use('/api/v8/evaluations', evaluationRouter);
  app.use('/api/v8/watchlist', watchlistRouter);
  app.use('/api/v8/classification', classificationRouter);
  app.use('/api/v8/scan', scanRouter);
  app.use('/api/v8/signals', signalRouter);
  app.use('/api/v8/backtest', backtestRouter);
  app.use('/api/v8/runs', runRouter);
  app.use('/api/v8/system', systemRouter);
  app.use('/api/v8/telegram', telegramRouter);

  // Auto-scan / Cron routes for local and production parity (supports all aliases and methods)
  const cronHandler = async (req: express.Request, res: express.Response) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-cron-token, x-telegram-token, x-telegram-chat-id');

    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }

    try {
      // Robust query string parsing supporting multiple '?' (e.g. ?async=true?bot_token=...)
      const queryParams: Record<string, string> = {};
      if (req.url && req.url.includes('?')) {
        const rawQueryPart = req.url.substring(req.url.indexOf('?') + 1);
        const normalizedQuery = rawQueryPart.replace(/\?/g, '&');
        const searchParams = new URLSearchParams(normalizedQuery);
        for (const [k, v] of searchParams.entries()) {
          queryParams[k] = v;
        }
      }
      for (const [k, v] of Object.entries(req.query || {})) {
        if (typeof v === 'string') queryParams[k] = v;
      }

      const b = req.body || {};
      const headers = req.headers || {};
      const cfg = telegramNotifier.getConfig();

      const botToken = (
        queryParams.bot_token ||
        queryParams.botToken ||
        queryParams.token ||
        b.botToken ||
        b.bot_token ||
        b.token ||
        (headers['x-telegram-token'] as string) ||
        cfg.botToken ||
        process.env.TELEGRAM_BOT_TOKEN ||
        '8979603920:AAGoWWVENKOR18zAG-hJRQb0earF-qkqO3E'
      )?.trim().replace(/^['"]|['"]$/g, '').replace(/^bot/i, '');

      const chatId = (
        queryParams.chat_id ||
        queryParams.chatId ||
        queryParams.chat ||
        b.chatId ||
        b.chat_id ||
        b.chat ||
        (headers['x-telegram-chat-id'] as string) ||
        cfg.chatId ||
        process.env.TELEGRAM_CHAT_ID ||
        '7774679329'
      )?.trim().replace(/^['"]|['"]$/g, '');

      const sourceUrl = `${req.protocol}://${req.get('host')}`;
      const isAsync =
        queryParams.async === 'true' ||
        queryParams.async === '1' ||
        queryParams.mode === 'async' ||
        b.async === true ||
        b.mode === 'async';

      if (isAsync) {
        console.log(`[server] 🚀 Async cron triggered (botToken: ${botToken ? 'provided' : 'none'}, chat: ${chatId})`);

        executeCronScan({
          botToken,
          chatId,
          triggeredBy: (headers['user-agent'] as string) || 'CronWebhookAsync',
          sourceUrl,
        })
          .then((scanRes) => {
            console.log(`[server] ✅ Async cron scan completed! Evaluated: ${scanRes.evaluated_count}, Signals: ${scanRes.actionable_signals_count}, Telegram: ${scanRes.telegram_status?.sent ? 'SENT(' + scanRes.telegram_status.target + ')' : scanRes.telegram_status?.message}`);
          })
          .catch((err) => {
            console.error('[server] ❌ Async cron background error:', err);
          });

        return res.status(202).json({
          success: true,
          status: 'ACCEPTED',
          mode: 'async',
          message: '크론 스캔이 백그라운드 태스크로 시작되었습니다. 완료 시 텔레그램 리포트 및 DB 저장이 자동 완수됩니다.',
          telegram_target: chatId ? `${chatId.slice(0, 3)}****` : null,
          timestamp: new Date().toISOString(),
        });
      }

      const result = await executeCronScan({
        botToken,
        chatId,
        triggeredBy: (headers['user-agent'] as string) || 'CronWebhook',
        sourceUrl,
      });

      res.status(result.success ? 200 : 500).json(result);
    } catch (err: any) {
      console.error('[server] Cron scan endpoint error:', err);
      res.status(500).json({
        success: false,
        error: err.message || 'Internal error executing cron scan',
        timestamp: new Date().toISOString(),
      });
    }
  };

  // Status endpoint for checking the last cron scan result (especially useful for async mode confirmation)
  app.get(['/api/v8/cron-scan/status', '/api/v8/cron/status', '/api/v8/cron/last-run'], (req, res) => {
    const lastResult = getLastCronScanResult();
    res.json({
      success: true,
      last_scan: lastResult,
      timestamp: new Date().toISOString(),
    });
  });

  app.all([
    '/api/v8/cron-scan',
    '/api/cron-scan',
    '/api/v8/cron',
    '/api/cron',
    '/cron-scan',
    '/api/v8/scan/cron',
    '/api/scan/cron',
  ], cronHandler);

  // Schedule information and internal scheduler endpoints
  app.get('/api/v8/schedule/status', (req, res) => {
    res.json({
      success: true,
      ...internalScheduler.getStatus(),
    });
  });

  app.post('/api/v8/schedule/trigger', async (req, res) => {
    try {
      const result = await internalScheduler.triggerManual();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/v8/schedule/info', (req, res) => {
    res.json({
      success: true,
      total_schedules: 3,
      schedules: [
        {
          slot: 'POST_MARKET',
          name: '미국 정규장 마감 브리핑 (종가 확정)',
          timeKST: '06:30 KST (평일 화~토)',
          cronUTC: '30 21 * * 1-5',
          purpose: '전일 종가 기준 4대 팩터 최종 집계 및 일봉 확정 시그널 도출',
          priority: 'HIGH',
        },
        {
          slot: 'PRE_MARKET',
          name: '프리마켓 갭 분석 & 당일 관심종목 압축',
          timeKST: '22:00 KST (평일 월~금)',
          cronUTC: '00 13 * * 1-5',
          purpose: '프리마켓 변동성 반영, 당일 진입 유효 후보군 압축 및 포트폴리오 비중 브리핑',
          priority: 'MEDIUM',
        },
        {
          slot: 'INTRADAY',
          name: '장중 급변 & 모멘텀 브레이크아웃 감시',
          timeKST: '02:00 KST (평일 화~토)',
          cronUTC: '00 17 * * 1-5',
          purpose: '장중 거래량 폭증 및 변동성 브레이크아웃 종목 포착 시 실시간 긴급 신호 발송',
          priority: 'MEDIUM',
        },
      ],
    });
  });

  app.post('/api/v8/telegram/preview', async (req, res) => {
    try {
      const { ticker } = req.body;
      if (!ticker) {
        return res.status(400).json({ error: 'Ticker is required' });
      }
      const evalItem = await evaluationRepository.findByTicker(ticker);
      if (!evalItem) {
        return res.status(404).json({ error: 'Ticker evaluation not found' });
      }
      const snapshot = createSignalSnapshot(evalItem);
      const message = buildSignalTelegramMessage(snapshot);

      res.json({
        success: true,
        ticker: evalItem.ticker,
        message,
        snapshot,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Vite middleware for development vs static in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Quant Decision Engine Server running on http://localhost:${PORT}`);
    // Start automated internal cron scheduler
    internalScheduler.start();
    // Bootstrap initial evaluation state asynchronously after server is up
    getInitialOrLatestEvaluations().catch((err) => {
      console.error('[Bootstrap Error] Failed to initialize evaluations:', err);
    });
  });
}

startServer();
