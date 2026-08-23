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

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

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
