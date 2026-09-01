import { Router } from 'express';
import { watchlistRepository } from '../db/repositories/watchlistRepository';
import { evaluationService } from '../pipeline/evaluationService';
import { evaluationRepository } from '../db/repositories/evaluationRepository';

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
      return res.status(400).json({ error: 'Ticker is required' });
    }
    const cleanTicker = ticker.toUpperCase().trim();

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
