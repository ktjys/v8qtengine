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
import { getInitialOrLatestEvaluations } from './src/pipeline/v8Pipeline';
import { evaluationRepository } from './src/db/repositories/evaluationRepository';
import { createSignalSnapshot, formatTelegramNotification } from './src/engine/signalEngine';

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

  app.use(express.json());
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

  // Auto-scan / Cron route for local and production parity
  app.all('/api/v8/cron-scan', async (req, res) => {
    try {
      const nowKST = new Date(Date.now() + 9 * 60 * 60 * 1000);
      const kstHour = nowKST.getUTCHours();
      const kstMinute = nowKST.getUTCMinutes();
      const kstTimeStr = `${String(kstHour).padStart(2, '0')}:${String(kstMinute).padStart(2, '0')} KST`;

      let slotName = '수동/실시간 스캔';
      if (kstHour >= 6 && kstHour <= 8) {
        slotName = '🌅 [1회차] 미국 정규장 마감 브리핑 (종가 확정)';
      } else if (kstHour >= 21 && kstHour <= 23) {
        slotName = '🌃 [2회차] 프리마켓 갭 분석 & 당일 관심종목 압축';
      } else if (kstHour >= 1 && kstHour <= 3) {
        slotName = '🌙 [3회차] 장중 급변 & 모멘텀 브레이크아웃 감시';
      }

      const scanResult = await getInitialOrLatestEvaluations();
      const evaluations = scanResult.evaluations || [];
      const actionableSignals = evaluations.filter((e) => e.decision.actionable);

      res.json({
        success: true,
        slot: slotName,
        kst_time: kstTimeStr,
        evaluated_count: evaluations.length,
        actionable_signals_count: actionableSignals.length,
        actionable_signals: actionableSignals.map((s) => ({
          ticker: s.ticker,
          name: s.name,
          decision: s.decision.decision,
          opportunity_score: s.opportunity.opportunity_score,
          risk_level: s.risk.risk_level,
          price: s.price,
        })),
        telegram_status: {
          configured: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
          message: process.env.TELEGRAM_BOT_TOKEN ? '발송 준비 완료' : '환경변수 미설정 (프리뷰 모드)',
        },
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Schedule information endpoint
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
      const message = formatTelegramNotification(snapshot);

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
    // Bootstrap initial evaluation state asynchronously after server is up
    getInitialOrLatestEvaluations().catch((err) => {
      console.error('[Bootstrap Error] Failed to initialize evaluations:', err);
    });
  });
}

startServer();
