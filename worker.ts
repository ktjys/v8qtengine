import { evaluationRepository } from './src/db/repositories/evaluationRepository';
import { watchlistRepository } from './src/db/repositories/watchlistRepository';
import { assetRepository } from './src/db/repositories/assetRepository';
import { signalRepository } from './src/db/repositories/signalRepository';
import { scanRunRepository } from './src/db/repositories/scanRunRepository';
import { evaluationService } from './src/pipeline/evaluationService';
import { dbClient } from './src/db/supabaseClient';
import { createSignalSnapshot } from './src/engine/signalEngine';
import { calculateBacktestMetrics } from './src/engine/backtestEngine';
import { INITIAL_HISTORICAL_SIGNALS, INITIAL_SCAN_RUNS, runV8PipelineOnSeedData } from './src/data/seed/initialData';
import { SignalSnapshot } from './src/types/v8';

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    },
  });
}

export default {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    if (method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
        },
      });
    }

    // Health check
    if (path === '/api/health') {
      return jsonResponse({ status: 'ok', provider: evaluationService.getProviderName() });
    }

    // Evaluations
    if (path === '/api/v8/evaluations/recalculate') {
      try {
        const [allAssets, watchlist] = await Promise.all([
          assetRepository.getAll(),
          watchlistRepository.getAll(),
        ]);
        const tickerSet = new Set<string>([
          ...allAssets.map((a) => a.ticker.toUpperCase()),
          ...watchlist.map((w) => w.ticker.toUpperCase()),
        ]);
        const targetTickers = Array.from(tickerSet);

        const results = await Promise.all(
          targetTickers.map(async (ticker) => {
            try {
              const override = dbClient.classifications.get(ticker);
              const ev = await evaluationService.evaluateTicker(ticker, override);
              return { success: true, ev };
            } catch (err: any) {
              return { success: false, ticker, error: err.message };
            }
          })
        );

        const successfulEvaluations = results.filter((r) => r.success && r.ev).map((r) => r.ev!);
        if (successfulEvaluations.length > 0) {
          await evaluationRepository.saveAll(successfulEvaluations);
        }

        return jsonResponse({
          success: true,
          message: `${successfulEvaluations.length}개 종목의 DB 기반 퀀트 평가가 새로고침되었습니다.`,
          count: successfulEvaluations.length,
          provider: evaluationService.getProviderName(),
          evaluations: successfulEvaluations,
        });
      } catch (err: any) {
        return jsonResponse({ success: false, error: err.message }, 500);
      }
    }

    if (path === '/api/v8/evaluations') {
      try {
        const [watchlist, allAssets] = await Promise.all([
          watchlistRepository.getAll(),
          assetRepository.getAll(),
        ]);
        const targetTickers = new Set<string>([
          ...watchlist.map((w) => w.ticker.toUpperCase()),
          ...allAssets.map((a) => a.ticker.toUpperCase()),
        ]);

        let existingEvaluations = await evaluationRepository.getAll();
        const evalMap = new Map(existingEvaluations.map((e) => [e.ticker.toUpperCase(), e]));

        let hasChanges = false;
        for (const ticker of targetTickers) {
          if (!evalMap.has(ticker)) {
            try {
              const override = dbClient.classifications.get(ticker);
              const newEval = await evaluationService.evaluateTicker(ticker, override);
              if (newEval) {
                evalMap.set(ticker, newEval);
                hasChanges = true;
              }
            } catch (e) {
              console.warn(`Evaluation failed for ${ticker}:`, e);
            }
          }
        }

        let finalEvaluations = Array.from(evalMap.values());

        if (hasChanges && finalEvaluations.length > 0) {
          await evaluationRepository.saveAll(finalEvaluations);
        }

        return jsonResponse({
          success: true,
          count: finalEvaluations.length,
          evaluations: finalEvaluations,
          provider: evaluationService.getProviderName(),
        });
      } catch (err: any) {
        return jsonResponse({
          success: false,
          count: 0,
          evaluations: [],
          error: err.message,
        }, 500);
      }
    }

    // Watchlist
    if (path === '/api/v8/watchlist' || path.startsWith('/api/v8/watchlist/')) {
      if (method === 'POST') {
        try {
          const body: any = await request.json();
          const cleanTicker = (body.ticker || '').toUpperCase().trim();
          if (!cleanTicker) {
            return jsonResponse({ success: false, error: 'Ticker is required' }, 400);
          }

          await assetRepository.upsert({
            ticker: cleanTicker,
            name: body.name || cleanTicker,
            asset_type: 'equity',
            is_active: true,
          });

          const added = await watchlistRepository.add({
            ticker: cleanTicker,
            name: body.name || cleanTicker,
            memo: body.memo || '신규 추가 종목',
            is_active: true,
          });

          let evaluation = null;
          try {
            const override = dbClient.classifications.get(cleanTicker);
            evaluation = await evaluationService.evaluateTicker(cleanTicker, override);
            if (evaluation) {
              await evaluationRepository.saveAll([evaluation]);
            }
          } catch (evErr: any) {
            console.warn('Auto evaluation error on watchlist POST:', evErr);
          }

          return jsonResponse({
            success: true,
            message: `${cleanTicker} 종목이 워치리스트에 추가되었습니다.`,
            item: added,
            evaluation,
          });
        } catch (e: any) {
          return jsonResponse({ success: false, error: e.message }, 500);
        }
      }

      if (method === 'DELETE') {
        const ticker = path.split('/').pop()?.toUpperCase();
        if (ticker) {
          await watchlistRepository.remove(ticker);
        }
        return jsonResponse({ success: true, message: `${ticker} removed` });
      }

      if (method === 'PATCH') {
        const ticker = path.split('/').pop()?.toUpperCase();
        const body: any = await request.json().catch(() => ({}));
        if (ticker) {
          await watchlistRepository.toggleActive(ticker, body.is_active ?? true);
        }
        return jsonResponse({ success: true, message: `${ticker} updated` });
      }

      // GET
      const list = await watchlistRepository.getAll();
      return jsonResponse({ success: true, count: list.length, watchlist: list });
    }

    // Signals
    if (path === '/api/v8/signals') {
      const savedSignals = await signalRepository.getAll();
      const evals = await evaluationRepository.getAll();
      const liveSignals: SignalSnapshot[] = evals
        .filter((e) => e.decision?.actionable)
        .map((ev) => createSignalSnapshot(ev));

      const signalMap = new Map<string, any>();
      savedSignals.forEach((s) => signalMap.set(`${s.ticker}-${s.signal_date}`, s));
      liveSignals.forEach((s) => {
        const key = `${s.ticker}-${s.signal_date}`;
        if (!signalMap.has(key)) signalMap.set(key, s);
      });

      const combined = Array.from(signalMap.values()).sort((a, b) => b.signal_date.localeCompare(a.signal_date));
      return jsonResponse({ success: true, count: combined.length, signals: combined });
    }

    // Backtest
    if (path === '/api/v8/backtest') {
      const allSignals = await signalRepository.getAll();
      const combined = allSignals.length > 0 ? allSignals : INITIAL_HISTORICAL_SIGNALS;
      const summary = calculateBacktestMetrics(combined);
      return jsonResponse({ success: true, data: { summary } });
    }

    // Runs
    if (path === '/api/v8/runs') {
      const runs = await scanRunRepository.getAll();
      const combined = runs.length > 0 ? runs : INITIAL_SCAN_RUNS;
      return jsonResponse({ success: true, count: combined.length, runs: combined });
    }

    // System DB Clear / Seed
    if (path === '/api/v8/system/db/clear' && method === 'POST') {
      const result = await dbClient.clearAllData();
      return jsonResponse({
        success: true,
        message: '모든 데이터베이스 테이블 및 메모리 레코드가 성공적으로 초기화/삭제되었습니다.',
        clearedTables: result.clearedTables,
      });
    }

    if (path === '/api/v8/system/db/seed' && method === 'POST') {
      const result = await dbClient.seedToActiveDb();
      return jsonResponse({
        success: true,
        message: `기본 유니버스 및 시그널 데이터(${result.seededCount}개)가 주입되었습니다.`,
        seededCount: result.seededCount,
      });
    }

    // Fallback to Cloudflare Static Assets if not an API route
    if (env && env.ASSETS && typeof env.ASSETS.fetch === 'function') {
      return env.ASSETS.fetch(request);
    }

    return new Response('Not Found', { status: 404 });
  },
};
