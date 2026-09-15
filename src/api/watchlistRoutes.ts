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

// Ticker format validation: 1 to 6 uppercase letters, optional dot or hyphen followed by 1 to 3 letters (e.g. AAPL, BRK.B, BF-B)
export const TICKER_REGEX = /^[A-Z]{1,6}([.-][A-Z]{1,3})?$/;

export function parseRawTickers(rawInput: string | string[]): string[] {
  if (Array.isArray(rawInput)) {
    return Array.from(new Set(rawInput.map((t) => String(t).trim().toUpperCase()).filter(Boolean)));
  }
  if (typeof rawInput !== 'string') return [];
  // Split by commas, spaces, slashes, tabs, or newlines
  const tokens = rawInput.split(/[,\s\n\r/]+/);
  return Array.from(new Set(tokens.map((t) => t.trim().toUpperCase()).filter(Boolean)));
}

async function validateSingleTickerWithYahoo(ticker: string): Promise<{ valid: boolean; symbol: string; name?: string; reason?: string }> {
  if (!TICKER_REGEX.test(ticker)) {
    return { valid: false, symbol: ticker, reason: '티커 기호 형식 오류 (1~6자 영문)' };
  }
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);
    const searchRes = await fetch(
      `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(ticker)}&quotesCount=3&newsCount=0`,
      {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      }
    );
    clearTimeout(timeoutId);
    if (searchRes.ok) {
      const data = (await searchRes.json()) as any;
      const quotes = data.quotes || [];
      if (quotes.length === 0) {
        return { valid: false, symbol: ticker, reason: '시장에 상장되지 않은 종목 코드' };
      }
      const exactMatch = quotes.find((q: any) => (q.symbol || '').toUpperCase() === ticker);
      if (exactMatch) {
        return { valid: true, symbol: ticker, name: exactMatch.shortname || exactMatch.longname || ticker };
      }
      const first = quotes[0];
      const firstSym = (first.symbol || '').toUpperCase();
      if (firstSym === ticker) {
        return { valid: true, symbol: ticker, name: first.shortname || first.longname || ticker };
      }
      return {
        valid: false,
        symbol: ticker,
        reason: `정확한 티커와 불일치 (유사 추천: ${firstSym})`,
      };
    }
  } catch (e: any) {
    console.warn(`[WatchlistRouter] Yahoo validation network fallback for ${ticker}:`, e.message);
  }
  return { valid: true, symbol: ticker };
}

// POST /api/v8/watchlist (Supports single ticker or comma-separated/batch tickers)
watchlistRouter.post('/', async (req, res) => {
  try {
    const rawInput = req.body.tickers || req.body.ticker;
    const memo = req.body.memo || '';
    const customName = req.body.name || '';

    if (!rawInput) {
      return res.status(400).json({ success: false, error: '추가할 티커가 입력되지 않았습니다.' });
    }

    const candidateTickers = parseRawTickers(rawInput);
    if (candidateTickers.length === 0) {
      return res.status(400).json({ success: false, error: '유효한 티커가 감지되지 않았습니다.' });
    }

    const existingList = await watchlistRepository.getAll();
    const existingTickerSet = new Set(existingList.map((w) => w.ticker.toUpperCase()));

    const alreadyExists: string[] = [];
    const rejected: Array<{ ticker: string; reason: string }> = [];
    const validCandidates: Array<{ ticker: string; name: string }> = [];

    for (const ticker of candidateTickers) {
      if (existingTickerSet.has(ticker)) {
        alreadyExists.push(ticker);
        continue;
      }

      const validation = await validateSingleTickerWithYahoo(ticker);
      if (!validation.valid) {
        rejected.push({ ticker, reason: validation.reason || '유효하지 않은 티커' });
      } else {
        validCandidates.push({
          ticker,
          name: candidateTickers.length === 1 && customName ? customName : (validation.name || ticker),
        });
      }
    }

    if (validCandidates.length === 0) {
      return res.status(400).json({
        success: false,
        error: rejected.length > 0 
          ? `입력하신 종목(${rejected.map(r => `${r.ticker}: ${r.reason}`).join(', ')})은 유효하지 않아 제외되었습니다.`
          : '입력하신 모든 종목이 이미 워치리스트에 등록되어 있습니다.',
        already_exists: alreadyExists,
        rejected,
      });
    }

    // Capacity Check
    const remainingSlots = Math.max(0, MAX_WATCHLIST_CAPACITY - existingList.length);
    if (remainingSlots <= 0) {
      return res.status(400).json({
        success: false,
        error: WATCHLIST_CAPACITY_ERROR_MESSAGE,
        current_count: existingList.length,
        max_capacity: MAX_WATCHLIST_CAPACITY,
      });
    }

    const toAdd = validCandidates.slice(0, remainingSlots);
    const capacityOverflow = validCandidates.slice(remainingSlots);
    for (const overflowItem of capacityOverflow) {
      rejected.push({ ticker: overflowItem.ticker, reason: '워치리스트 슬롯 한도(최대 30개) 초과' });
    }

    const addedItems: any[] = [];
    const newEvaluations: any[] = [];

    for (const item of toAdd) {
      const added = await watchlistRepository.add({
        ticker: item.ticker,
        name: item.name,
        memo: memo || '사용자 추가 감시 종목',
        is_active: true,
      });
      addedItems.push(added);

      try {
        const evalResult = await evaluationService.evaluateTicker(item.ticker);
        if (evalResult) {
          newEvaluations.push(evalResult);
        }
      } catch (evalErr) {
        console.warn(`[WatchlistRouter] Could not evaluate added ticker ${item.ticker}:`, (evalErr as Error).message);
      }
    }

    // Save evaluations
    if (newEvaluations.length > 0) {
      try {
        const allEvals = await evaluationRepository.getAll();
        const newTickerSet = new Set(newEvaluations.map((e) => e.ticker));
        const keptEvals = allEvals.filter((e) => !newTickerSet.has(e.ticker));
        await evaluationRepository.saveAll([...keptEvals, ...newEvaluations]);
      } catch (saveErr) {
        console.warn('[WatchlistRouter] Failed to save batch evaluations:', saveErr);
      }
    }

    res.json({
      success: true,
      count: addedItems.length,
      added_tickers: addedItems.map((i) => i.ticker),
      item: addedItems[0],
      items: addedItems,
      already_exists: alreadyExists,
      rejected,
      message: `${addedItems.length}개 종목 추가 완료${rejected.length > 0 ? ` (제외 ${rejected.length}개)` : ''}`,
    });
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
