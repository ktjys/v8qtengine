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
import { FULL_SCHEMA_SQL } from './src/db/schemaSql';
import { runDatabaseDiagnostics } from './src/db/diagnostics';

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

let dbInitialized = false;

async function ensureDbConnected(env: any): Promise<boolean> {
  if (dbClient.isSupabaseConnected) return true;
  if (dbInitialized) return dbClient.isSupabaseConnected;
  dbInitialized = true;

  const envUrl = env?.SUPABASE_URL || '';
  const envKey = env?.SUPABASE_KEY || '';
  if (envUrl && envKey) {
    const result = await dbClient.connectFromTrustedEnv(envUrl, envKey);
    return result.success;
  }
  return false;
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

    await ensureDbConnected(env);

    const dbNotConnected = !dbClient.isSupabaseConnected;
    const dbErrorResponse = jsonResponse({
      success: false,
      error: 'Supabase DB가 연결되지 않았습니다. Cloudflare 환경변수 SUPABASE_URL과 SUPABASE_KEY를 설정하세요.',
      connected: false,
    }, 503);

    // Health check
    if (path === '/api/health') {
      return jsonResponse({
        status: 'ok',
        provider: evaluationService.getProviderName(),
        db_connected: dbClient.isSupabaseConnected,
        db_config_source: dbClient.configSource,
      });
    }

    // Evaluations
    if (path === '/api/v8/evaluations/recalculate') {
      if (dbNotConnected) return dbErrorResponse;
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
      if (dbNotConnected) return dbErrorResponse;
      try {
        const [existingEvaluations, allAssets] = await Promise.all([
          evaluationRepository.getAll(),
          assetRepository.getAll(),
        ]);
        const assetTickerSet = new Set(allAssets.map((a) => a.ticker.toUpperCase()));

        const finalEvaluations = assetTickerSet.size > 0
          ? existingEvaluations.filter((e) => assetTickerSet.has(e.ticker.toUpperCase()))
          : existingEvaluations;

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
      if (dbNotConnected) return dbErrorResponse;
      const list = await watchlistRepository.getAll();
      return jsonResponse({ success: true, count: list.length, watchlist: list });
    }

    // Signals
    if (path === '/api/v8/signals') {
      if (dbNotConnected) return dbErrorResponse;
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
      if (dbNotConnected) return dbErrorResponse;
      const allSignals = await signalRepository.getAll();
      const combined = allSignals.length > 0 ? allSignals : INITIAL_HISTORICAL_SIGNALS;
      const summary = calculateBacktestMetrics(combined);
      return jsonResponse({ success: true, data: { summary } });
    }

    // Runs
    if (path === '/api/v8/runs') {
      if (dbNotConnected) return dbErrorResponse;
      const runs = await scanRunRepository.getAll();
      const combined = runs.length > 0 ? runs : INITIAL_SCAN_RUNS;
      return jsonResponse({ success: true, count: combined.length, runs: combined });
    }

    // ========== System Routes ==========

    // GET /api/v8/system/status
    if (path === '/api/v8/system/status') {
      const dbStatus = dbClient.getStatus();
      const dbConfig = dbClient.getConfig();
      return jsonResponse({
        success: true,
        provider: evaluationService.getProviderName(),
        db: dbStatus,
        db_config: dbConfig,
        timestamp: new Date().toISOString(),
      });
    }

    // GET /api/v8/system/db/status
    if (path === '/api/v8/system/db/status') {
      try {
        const status = dbClient.getStatus();
        const config = dbClient.getConfig();
        const tables = await dbClient.checkTableStatus();
        return jsonResponse({ success: true, status, config, tables });
      } catch (err: any) {
        return jsonResponse({ success: false, error: err.message }, 500);
      }
    }

    // GET /api/v8/system/db/diagnostics
    if (path === '/api/v8/system/db/diagnostics') {
      try {
        const diagnostics = await runDatabaseDiagnostics();
        return jsonResponse({ success: true, ...diagnostics });
      } catch (err: any) {
        return jsonResponse({ success: false, error: err?.message || '진단 실행 중 오류가 발생했습니다.' }, 500);
      }
    }

    // NOTE: There is no POST /api/v8/system/db/config route. DB credentials are
    // fixed at process/Worker startup from trusted env bindings only — no HTTP
    // request (from a browser or otherwise) can set or change them.

    // GET /api/v8/system/db/schema-sql
    if (path === '/api/v8/system/db/schema-sql') {
      return jsonResponse({ success: true, sql: FULL_SCHEMA_SQL });
    }

    // POST /api/v8/system/provider
    if (path === '/api/v8/system/provider' && method === 'POST') {
      try {
        const body: any = await request.json();
        const { provider } = body;
        if (provider === 'seed' || provider === 'yahoo') {
          evaluationService.setProvider(provider);
          return jsonResponse({ success: true, active_provider: provider });
        }
        return jsonResponse({ success: false, error: "Invalid provider. Must be 'yahoo' or 'seed'." }, 400);
      } catch (err: any) {
        return jsonResponse({ success: false, error: err.message }, 500);
      }
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

    // ========== Scan Run ==========
    if (path === '/api/v8/scan/run' && method === 'POST') {
      if (dbNotConnected) return dbErrorResponse;
      try {
        const startTime = Date.now();
        let body: any = {};
        try {
          body = await request.json();
        } catch {}

        const result = runV8PipelineOnSeedData();
        const duration = Date.now() - startTime;

        const runLog = {
          run_id: `edge-run-${Date.now()}`,
          started_at: new Date(startTime).toISOString(),
          finished_at: new Date().toISOString(),
          watchlist_count: result.watchlist.length,
          evaluated_count: result.evaluations.length,
          failure_count: body.simulate_partial_failure ? 1 : 0,
          status: body.simulate_partial_failure ? 'PARTIAL_SUCCESS' : 'SUCCESS',
          error_summary: body.simulate_partial_failure
            ? 'Simulated quote API timeout on last ticker (Gracefully isolated)'
            : undefined,
        };

        const actionableSignals = result.evaluations.filter((e) => e.decision.actionable);

        return jsonResponse({
          success: true,
          scan_log: runLog,
          new_signals: actionableSignals.map((ev) => ({
            id: `sig-${ev.ticker}-${Date.now()}`,
            signal_date: new Date().toISOString().split('T')[0],
            ticker: ev.ticker,
            name: ev.name,
            signal_price: ev.price,
            strategy_type: ev.classification.strategy_type,
            asset_type: ev.classification.asset_type,
            opportunity_score: ev.opportunity.opportunity_score,
            risk_score: ev.risk.risk_score,
            risk_level: ev.risk.risk_level,
            decision: ev.decision.decision,
            signal_confidence: ev.decision.confidence,
            classification_confidence: ev.classification.confidence,
            primary_reason: ev.decision.reason,
            created_at: new Date().toISOString(),
            status: 'ACTIVE',
          })),
          evaluations_count: result.evaluations.length,
          evaluations: result.evaluations,
        });
      } catch (err: any) {
        return jsonResponse({ success: false, error: err.message || 'Scan failed' }, 500);
      }
    }

    // ========== Classification Override ==========
    if (path === '/api/v8/classification/override' && method === 'POST') {
      try {
        const body: any = await request.json();
        const { ticker, asset_type, strategy_type, confidence, reason } = body;
        if (!ticker) {
          return jsonResponse({ success: false, error: 'Ticker is required' }, 400);
        }
        dbClient.classifications.set(ticker.toUpperCase(), {
          ticker: ticker.toUpperCase(),
          asset_type,
          strategy_type,
          confidence,
          reason,
          classification_source: 'manual',
          classified_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        return jsonResponse({ success: true, message: `${ticker} 분류가 수동 지정되었습니다.` });
      } catch (err: any) {
        return jsonResponse({ success: false, error: err.message }, 500);
      }
    }

    if (path.startsWith('/api/v8/classification/override/') && method === 'DELETE') {
      const ticker = path.split('/').pop()?.toUpperCase();
      if (ticker) {
        dbClient.classifications.delete(ticker);
      }
      return jsonResponse({ success: true, message: `${ticker} 분류가 자동 분석으로 복원되었습니다.` });
    }

    // ========== Backtest Backfill ==========
    if (path === '/api/v8/backtest/backfill' && method === 'POST') {
      if (dbNotConnected) return dbErrorResponse;
      try {
        const { runHistoricalBackfill } = await import('./src/engine/backfillEngine');
        const body: any = await request.json();
        const { lookbackRange, tickers, opportunityThreshold, replaceExisting } = body;
        const result = await runHistoricalBackfill({
          lookbackRange: lookbackRange || '1y',
          tickers,
          opportunityThreshold: opportunityThreshold ? Number(opportunityThreshold) : 70,
          replaceExisting: replaceExisting ?? true,
        });
        return jsonResponse({
          success: true,
          message: `과거 ${lookbackRange || '1y'} 데이터 백필 완료`,
          result,
        });
      } catch (err: any) {
        return jsonResponse({ success: false, error: err.message || 'Backfill failed' }, 500);
      }
    }

    // ========== Telegram ==========
    if (path === '/api/v8/telegram/test-broadcast' && method === 'POST') {
      try {
        const body: any = await request.json();
        const { chat_id, message } = body;
        return jsonResponse({
          success: true,
          message: 'Telegram test broadcast sent',
          chat_id,
        });
      } catch (err: any) {
        return jsonResponse({ success: false, error: err.message }, 500);
      }
    }

    // Fallback to Cloudflare Static Assets if not an API route
    if (env && env.ASSETS && typeof env.ASSETS.fetch === 'function') {
      return env.ASSETS.fetch(request);
    }

    return new Response('Not Found', { status: 404 });
  },
};
