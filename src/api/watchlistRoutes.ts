import { Router } from 'express';
import { watchlistRepository } from '../db/repositories/watchlistRepository';
import { evaluationService } from '../pipeline/evaluationService';
import { evaluationRepository } from '../db/repositories/evaluationRepository';
import { MAX_WATCHLIST_CAPACITY_PER_MARKET, getWatchlistCapacityErrorMessage } from '../constants/limits';
import { resolveSingleQuery, searchStockMaster, StockInfo } from '../utils/stockSearchService';
import { getStockDisplayInfo, detectMarketRegion } from '../utils/marketUtils';

export const watchlistRouter = Router();

// GET /api/v8/watchlist/search?q=... (실시간 종목명 및 티커 통합 검색)
watchlistRouter.get('/search', async (req, res) => {
  try {
    const q = ((req.query.q as string) || '').trim();
    if (!q) {
      return res.json({ success: true, results: [] });
    }

    // 1. Authoritative local stock master database search
    const localMatches = searchStockMaster(q, 10);

    // 2. Yahoo Finance search fallback — also run for Korean text queries,
    //    since Korean ETF names are not fully covered by the local master DB
    const isKoreanQuery = /[가-힣]/.test(q);
    let yahooMatches: StockInfo[] = [];
    if (localMatches.length < 5 || isKoreanQuery) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2500);
        const yRes = await fetch(
          `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=6&newsCount=0`,
          {
            signal: controller.signal,
            headers: { 'User-Agent': 'Mozilla/5.0' },
          }
        );
        clearTimeout(timeoutId);
        if (yRes.ok) {
          const yData = (await yRes.json()) as any;
          const rawQuotes = yData.quotes || yData.finance?.result?.[0]?.quotes || [];
          yahooMatches = rawQuotes
            .filter((quote: any) => quote.symbol && !quote.symbol.includes('='))
            .map((quote: any) => {
              let sym = quote.symbol.toUpperCase();
              if (/^\d{6}$/.test(sym)) {
                sym = `${sym}.KS`;
              }
              const isKr = sym.endsWith('.KS') || sym.endsWith('.KQ');
              const display = getStockDisplayInfo(sym, quote.shortname || quote.longname);
              return {
                ticker: sym,
                name: display.primaryName || quote.shortname || quote.longname || sym,
                englishName: quote.longname || quote.shortname || sym,
                market: (isKr ? 'KR' : 'US') as 'KR' | 'US',
                exchange: quote.exchange || (isKr ? (sym.endsWith('.KQ') ? 'KOSDAQ' : 'KOSPI') : 'US'),
                sector: quote.sector || quote.industry || (isKr ? '국내 상장 종목' : '해외 주식'),
              };
            });
        }
      } catch {}
    }

    const seen = new Set<string>();
    const combined: StockInfo[] = [];
    const rank = (market: string) => (isKoreanQuery ? (market === 'KR' ? 0 : 1) : 0);
    for (const item of [...localMatches, ...yahooMatches].sort((a, b) => rank(a.market) - rank(b.market))) {
      const key = item.ticker.toUpperCase();
      if (!seen.has(key)) {
        seen.add(key);
        combined.push(item);
      }
    }

    res.json({ success: true, query: q, results: combined.slice(0, 10) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message, results: [] });
  }
});

// GET /api/v8/watchlist
watchlistRouter.get('/', async (req, res) => {
  try {
    const list = await watchlistRepository.getAll();
    res.json({ success: true, watchlist: list });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// Ticker format validation:
// 1) US Stocks & ETFs: 1 to 6 uppercase letters, optional dot or hyphen (e.g. AAPL, BRK.B, BF-B)
// 2) Korean Stocks & ETFs: 6 digits (e.g. 005930), or 6 digits with .KS / .KQ (e.g. 005930.KS, 373220.KS, 247540.KQ)
export const TICKER_REGEX = /^([A-Z]{1,6}([.-][A-Z]{1,3})?|\d{6}(\.(KS|KQ))?)$/;

export interface ParsedTickerResult {
  ticker: string;
  name?: string;
  originalInput: string;
  resolved: boolean;
}

export function parseRawTickers(rawInput: string | string[]): ParsedTickerResult[] {
  let tokens: string[] = [];
  if (Array.isArray(rawInput)) {
    tokens = rawInput.map((t) => String(t).trim()).filter(Boolean);
  } else if (typeof rawInput === 'string') {
    const trimmed = rawInput.trim();
    if (trimmed.includes(',')) {
      tokens = trimmed.split(',').map((t) => t.trim()).filter(Boolean);
    } else {
      // First check if the entire query resolves to a single stock (e.g. "LG 에너지솔루션", "현대 자동차", "에코프로 비엠")
      const directResolved = resolveSingleQuery(trimmed);
      if (directResolved.resolved) {
        tokens = [trimmed];
      } else {
        tokens = trimmed.split(/[\s\n\r/]+/).map((t) => t.trim()).filter(Boolean);
      }
    }
  }

  const seen = new Set<string>();
  const results: ParsedTickerResult[] = [];

  for (const rawToken of tokens) {
    const resolved = resolveSingleQuery(rawToken);
    let targetTicker = resolved.resolved ? resolved.ticker : rawToken.toUpperCase().trim();
    // Auto-normalize 6 digits to .KS if pure numbers
    if (/^[0-9]{6}$/.test(targetTicker)) {
      targetTicker = `${targetTicker}.KS`;
    }
    if (!seen.has(targetTicker)) {
      seen.add(targetTicker);
      results.push({
        ticker: targetTicker,
        name: resolved.resolved ? resolved.name : undefined,
        originalInput: rawToken,
        resolved: resolved.resolved,
      });
    }
  }

  return results;
}

async function validateSingleTickerWithYahoo(
  ticker: string,
  preferredName?: string
): Promise<{ valid: boolean; symbol: string; name?: string; reason?: string }> {
  // If already known in master database or preferred name provided, accept immediately
  const resolved = resolveSingleQuery(ticker);
  if (resolved.resolved) {
    return {
      valid: true,
      symbol: resolved.ticker,
      name: preferredName || resolved.name,
    };
  }

  if (!TICKER_REGEX.test(ticker)) {
    return { valid: false, symbol: ticker, reason: '티커 기호 또는 종목명을 인식할 수 없습니다' };
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
        return { valid: true, symbol: ticker, name: preferredName || exactMatch.shortname || exactMatch.longname || ticker };
      }
      const first = quotes[0];
      const firstSym = (first.symbol || '').toUpperCase();
      if (firstSym === ticker) {
        return { valid: true, symbol: ticker, name: preferredName || first.shortname || first.longname || ticker };
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
  return { valid: true, symbol: ticker, name: preferredName || ticker };
}

// POST /api/v8/watchlist (Supports single ticker or comma-separated/batch tickers or Korean names)
watchlistRouter.post('/', async (req, res) => {
  try {
    const rawInput = req.body.tickers || req.body.ticker;
    const memo = req.body.memo || '';
    const customName = req.body.name || '';

    if (!rawInput) {
      return res.status(400).json({ success: false, error: '추가할 종목명 또는 티커가 입력되지 않았습니다.' });
    }

    const candidateItems = parseRawTickers(rawInput);
    if (candidateItems.length === 0) {
      return res.status(400).json({ success: false, error: '유효한 종목명 또는 티커가 감지되지 않았습니다.' });
    }

    const existingList = await watchlistRepository.getAll();
    const existingTickerSet = new Set(existingList.map((w) => w.ticker.toUpperCase()));

    const alreadyExists: string[] = [];
    const rejected: Array<{ ticker: string; reason: string }> = [];
    const validCandidates: Array<{ ticker: string; name: string }> = [];

    for (const item of candidateItems) {
      if (existingTickerSet.has(item.ticker.toUpperCase())) {
        alreadyExists.push(item.ticker);
        continue;
      }

      const validation = await validateSingleTickerWithYahoo(
        item.ticker,
        candidateItems.length === 1 && customName ? customName : item.name
      );

      if (!validation.valid) {
        rejected.push({
          ticker: item.originalInput,
          reason: validation.reason || '유효하지 않은 종목',
        });
      } else {
        validCandidates.push({
          ticker: validation.symbol,
          name: validation.name || item.name || validation.symbol,
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

    const candidatesByMarket = new Map<'US' | 'KR', typeof validCandidates>();
    for (const candidate of validCandidates) {
      const market = detectMarketRegion(candidate.ticker);
      if (!candidatesByMarket.has(market)) {
        candidatesByMarket.set(market, []);
      }
      candidatesByMarket.get(market)!.push(candidate);
    }

    const toAdd: typeof validCandidates = [];
    for (const [market, marketCandidates] of candidatesByMarket) {
      const marketList = existingList.filter(w => (w.market_region || detectMarketRegion(w.ticker)) === market);
      const remainingSlots = Math.max(0, MAX_WATCHLIST_CAPACITY_PER_MARKET - marketList.length);
      const marketToAdd = marketCandidates.slice(0, remainingSlots);
      const marketOverflow = marketCandidates.slice(remainingSlots);
      for (const overflowItem of marketOverflow) {
        rejected.push({ ticker: overflowItem.ticker, reason: getWatchlistCapacityErrorMessage(market) });
      }
      toAdd.push(...marketToAdd);
    }

    if (toAdd.length === 0) {
      return res.status(400).json({
        success: false,
        error: rejected.map(r => `${r.ticker}: ${r.reason}`).join(', '),
        already_exists: alreadyExists,
        rejected,
      });
    }

    const addedItems: any[] = [];
    const newEvaluations: any[] = [];

    for (const item of toAdd) {
      const market = detectMarketRegion(item.ticker);
      const added = await watchlistRepository.add({
        ticker: item.ticker,
        name: item.name,
        memo: memo || '사용자 추가 감시 종목',
        is_active: true,
        market_region: market,
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
