import { Router } from 'express';
import { watchlistRepository } from '../db/repositories/watchlistRepository';
import { evaluationService } from '../pipeline/evaluationService';
import { evaluationRepository } from '../db/repositories/evaluationRepository';
import { MAX_WATCHLIST_CAPACITY, WATCHLIST_CAPACITY_ERROR_MESSAGE } from '../constants/limits';

export const watchlistRouter = Router();

// GET /api/v8/watchlist
watchlistRouter.get('/', async (req, res) => {
  try {
    const list = await watchlistRepository.getAll();
    res.json({ success: true, watchlist: list });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// POST /api/v8/watchlist
watchlistRouter.post('/', async (req, res) => {
  try {
    const { ticker, name, memo } = req.body;
    if (!ticker) {
      return res.status(400).json({ success: false, error: 'Ticker is required' });
    }
    const cleanTicker = ticker.toUpperCase().trim();

    // 0. Hard Limit Enforcement (Max 30 items)
    const existingList = await watchlistRepository.getAll();
    const isAlreadyInWatchlist = existingList.some((w) => w.ticker === cleanTicker);
    if (!isAlreadyInWatchlist && existingList.length >= MAX_WATCHLIST_CAPACITY) {
      return res.status(400).json({
        success: false,
        error: WATCHLIST_CAPACITY_ERROR_MESSAGE,
        current_count: existingList.length,
        max_capacity: MAX_WATCHLIST_CAPACITY,
      });
    }

    // 1. Ticker Validation with Yahoo Finance Search API
    try {
      const searchRes = await fetch(
        `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(cleanTicker)}&quotesCount=1&newsCount=0`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          }
        }
      );
      if (searchRes.ok) {
        const data = await searchRes.json();
        const quotes = data.quotes || [];
        
        if (quotes.length === 0) {
          return res.status(400).json({ success: false, error: `'${cleanTicker}'은(는) 존재하지 않는 종목 코드입니다.` });
        }
        
        const topMatch = quotes[0];
        const foundSymbol = topMatch.symbol.toUpperCase();
        
        if (foundSymbol !== cleanTicker) {
          const assetName = topMatch.shortname || topMatch.longname || '해당 기업/자산';
          return res.status(400).json({ 
            success: false, 
            error: `잘못된 종목 코드입니다. 혹시 [${assetName}]의 올바른 티커인 '${foundSymbol}'을(를) 찾으시나요?` 
          });
        }
      }
    } catch (searchErr) {
      console.warn('[WatchlistRouter] Ticker validation request failed, proceeding anyway:', searchErr);
    }

    // 새 종목은 항상 is_active: true로 생성
    const item = await watchlistRepository.add({ ticker: cleanTicker, name, memo, is_active: true });

    // Evaluate the new item and save to DB
    try {
      const evalResult = await evaluationService.evaluateTicker(cleanTicker);
      const allEvals = await evaluationRepository.getAll();
      const filtered = allEvals.filter((e) => e.ticker !== cleanTicker);
      filtered.push(evalResult);
      await evaluationRepository.saveAll(filtered);
    } catch (evalErr) {
      console.warn(`[WatchlistRouter] Could not evaluate added ticker ${cleanTicker}:`, (evalErr as Error).message);
    }

    res.json({ success: true, item });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// PATCH /api/v8/watchlist/:ticker
watchlistRouter.patch('/:ticker', async (req, res) => {
  try {
    const ticker = req.params.ticker.toUpperCase();
    const { is_active, memo } = req.body;
    const updated = await watchlistRepository.update(ticker, { is_active, memo });
    if (!updated) {
      return res.status(404).json({ error: 'Ticker not found' });
    }
    res.json({ success: true, item: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// Known initial dummy/sample tickers that were pre-seeded in the database
const INITIAL_DUMMY_TICKERS = new Set([
  'AAPL', 'AMD', 'AMZN', 'GOOGL', 'HOOD', 'JNJ', 'META', 'MSFT', 'NVDA',
  'OKLO', 'ORCL', 'PLTR', 'SCHD', 'SMH', 'SPCX', 'TSLA', 'V', 'VOO',
  'AVGO', 'QCOM', 'TSM', 'NFLX', 'CRWD', 'PANW', 'COST', 'LLY', 'NVO', 'SPY'
]);

const handleBulkDelete = async (req: any, res: any) => {
  try {
    const mode = (req.query.mode as string) || req.body?.mode;
    const bodyTickers = Array.isArray(req.body?.tickers) ? req.body.tickers : [];

    if (bodyTickers.length > 0) {
      const removedCount = await watchlistRepository.removeMany(bodyTickers);
      return res.json({ success: true, count: removedCount, message: `${removedCount}개 종목 삭제 완료` });
    }

    if (mode === 'dummy') {
      const currentList = await watchlistRepository.getAll();
      const dummyTickers = currentList
        .map((w) => w.ticker.toUpperCase())
        .filter((t) => INITIAL_DUMMY_TICKERS.has(t));

      const removedCount = await watchlistRepository.removeMany(dummyTickers);
      return res.json({
        success: true,
        count: removedCount,
        removed_tickers: dummyTickers,
        message: `더미(샘플) 종목 ${removedCount}개가 정리되었습니다.`,
      });
    }

    if (mode === 'all') {
      await watchlistRepository.removeAll();
      return res.json({ success: true, message: '워치리스트가 완전히 비워졌습니다.' });
    }

    res.status(400).json({
      success: false,
      error: 'mode=dummy, mode=all, 또는 tickers 배열을 제공해야 합니다.',
    });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
};

// DELETE /api/v8/watchlist (Bulk delete, clear all, or clear dummy tickers)
watchlistRouter.delete('/', handleBulkDelete);
watchlistRouter.post('/clear', handleBulkDelete);
watchlistRouter.delete('/bulk', handleBulkDelete);

// DELETE /api/v8/watchlist/:ticker
watchlistRouter.delete('/:ticker', async (req, res) => {
  try {
    const ticker = req.params.ticker.toUpperCase();
    await watchlistRepository.remove(ticker);
    res.json({ success: true, message: `Removed ${ticker}` });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});
