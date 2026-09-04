import { evaluationRepository } from './src/db/repositories/evaluationRepository';
import { watchlistRepository } from './src/db/repositories/watchlistRepository';
import { assetRepository } from './src/db/repositories/assetRepository';
import { signalRepository } from './src/db/repositories/signalRepository';
import { scanRunRepository } from './src/db/repositories/scanRunRepository';
import { evaluationService } from './src/pipeline/evaluationService';
import { scanService } from './src/pipeline/scanService';
import { dailyScoreHistoryService } from './src/pipeline/dailyScoreHistoryService';
import { dbClient } from './src/db/supabaseClient';
import { createSignalSnapshot } from './src/engine/signalEngine';
import { calculateBacktestMetrics } from './src/engine/backtestEngine';
import { INITIAL_HISTORICAL_SIGNALS, INITIAL_SCAN_RUNS, runV8PipelineOnSeedData } from './src/data/seed/initialData';
import { SignalSnapshot } from './src/types/v8';
import { FULL_SCHEMA_SQL } from './src/db/schemaSql';
import { runDatabaseDiagnostics } from './src/db/diagnostics';
import { executeCronScan, getLastCronScanResult } from './src/engine/cronScanEngine';
import { telegramNotifier } from './src/notification/telegramNotifier';

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

  const envUrl = env?.SUPABASE_URL || (typeof process !== 'undefined' ? process.env?.SUPABASE_URL : '') || '';
  const envKey = env?.SUPABASE_KEY || (typeof process !== 'undefined' ? process.env?.SUPABASE_KEY : '') || '';
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
        const existingEvaluations = await evaluationRepository.getAll();

        return jsonResponse({
          success: true,
          count: existingEvaluations.length,
          evaluations: existingEvaluations,
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

    // Evaluation & Price History for Stock Charts (e.g. /api/v8/evaluations/history/:ticker or /:ticker/history)
    if (
      (path.startsWith('/api/v8/evaluations/history/') ||
        (path.startsWith('/api/v8/evaluations/') && path.endsWith('/history'))) &&
      method === 'GET'
    ) {
      try {
        let ticker = '';
        if (path.startsWith('/api/v8/evaluations/history/')) {
          ticker = path.replace('/api/v8/evaluations/history/', '').split('?')[0].split('/')[0].toUpperCase().trim();
        } else {
          const parts = path.split('/');
          ticker = (parts[parts.length - 2] || '').toUpperCase().trim();
        }

        if (!ticker) {
          return jsonResponse({ success: false, error: 'Ticker is required' }, 400);
        }

        const range = url.searchParams.get('range') || '6m';
        const data = await dailyScoreHistoryService.getDailyScoreHistory(ticker, range);

        return jsonResponse({
          success: true,
          data,
        });
      } catch (err: any) {
        console.error('[Worker] Daily score history error for ' + path + ':', err);
        return jsonResponse(
          {
            success: false,
            error: err.message || 'Failed to fetch historical chart data',
          },
          500
        );
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

      const [list, evaluations] = await Promise.all([
        watchlistRepository.getAll(),
        evaluationRepository.getAll(),
      ]);
      
      const evalMap = new Map(evaluations.map(ev => [ev.ticker, ev]));
      
      const merged = list.map(item => {
        const ev = evalMap.get(item.ticker);
        if (ev) return ev;
        
        return {
          ticker: item.ticker,
          name: item.name || item.ticker,
          price: 0,
          change1d: 0,
          evaluated_at: item.created_at || new Date().toISOString(),
          classification: {
            ticker: item.ticker,
            asset_type: 'equity' as const,
            strategy_type: 'CORE_MOMENTUM' as const,
            confidence: 0,
            classification_source: 'watchlist_only' as const,
            reason: '워치리스트만 등록됨, 평가 전',
            classified_at: item.created_at || new Date().toISOString(),
            updated_at: item.created_at || new Date().toISOString(),
          },
          opportunity: {
            opportunity_score: 0,
            technical_score: 0,
            momentum_score: 0,
            fundamental_score: 0,
            valuation_score: 0,
            components: {
              weights: { technical: 0.35, momentum: 0.35, fundamental: 0.15, valuation: 0.15 },
              breakdown: { technical: 0, momentum: 0, fundamental: 0, valuation: 0 },
            },
            summary_reason: '평가 미완료',
          },
          risk: {
            risk_score: 0,
            risk_level: 'MEDIUM' as const,
            reasons: [],
            deductions: [],
          },
          decision: {
            decision: 'WATCH' as const,
            confidence: 0,
            actionable: false,
            strategy_type: 'CORE_MOMENTUM' as const,
            reasons: [],
            summary: '평가 미완료',
          },
          signal_generated: false,
          data_quality: { isFresh: false, isComplete: false, qualityScore: 0, warnings: ['평가 미실행'] },
        };
      });
      
      return jsonResponse({ success: true, count: merged.length, watchlist: list, evaluations: merged });
    }

    // Signals
    if (path === '/api/v8/signals') {
      const savedSignals = await signalRepository.getAll();
      const evals = await evaluationRepository.getAll();
      const liveSignals: SignalSnapshot[] = evals
        .filter((e) => e.signal_generated)
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
      return jsonResponse({ success: true, data: { summary }, summary });
    }

    // Runs
    if (path === '/api/v8/runs') {
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
      try {
        let body: any = {};
        try {
          body = await request.json();
        } catch {}

        const result = await scanService.executeScan({
          simulatePartialFailure: body.simulate_partial_failure === true,
          providerType: body.provider_type || 'yahoo',
          saveToDb: true,
        });

        const runLog = result.runLog;
        const actionableSignals = (result.evaluations || []).filter((e: any) => e.signal_generated);

        // Telegram Notification Dispatch
        let telegramStatus: { sent: boolean; message: string; target?: string | null } = {
          sent: false,
          message: '텔레그램 미전송 (비활성화 또는 설정 미등록)',
        };

        const sendTelegram = body.send_telegram !== false;
        const cfg = telegramNotifier.getConfig();
        const botToken = (
          body.botToken ||
          request.headers.get('x-telegram-token') ||
          env?.TELEGRAM_BOT_TOKEN ||
          process.env.TELEGRAM_BOT_TOKEN ||
          cfg.botToken ||
          ''
        ).trim().replace(/^['"]|['"]$/g, '').replace(/^bot/i, '');

        const chatId = (
          body.chatId ||
          request.headers.get('x-telegram-chat-id') ||
          env?.TELEGRAM_CHAT_ID ||
          process.env.TELEGRAM_CHAT_ID ||
          cfg.chatId ||
          ''
        ).trim().replace(/^['"]|['"]$/g, '');

        if (sendTelegram) {
          if (botToken && chatId) {
            try {
              const nowKST = new Date(Date.now() + 9 * 60 * 60 * 1000);
              const kstTimeStr = `${nowKST.getUTCFullYear()}-${String(nowKST.getUTCMonth() + 1).padStart(2, '0')}-${String(nowKST.getUTCDate()).padStart(2, '0')} ${String(nowKST.getUTCHours()).padStart(2, '0')}:${String(nowKST.getUTCMinutes()).padStart(2, '0')}:${String(nowKST.getUTCSeconds()).padStart(2, '0')} KST`;

              let reportText = `<b>🚀 퀀트 스캐너 실행 완료 리포트</b>\n`;
              reportText += `🕒 <b>실행 시각:</b> ${kstTimeStr}\n`;
              reportText += `━━━━━━━━━━━━━━━━━━━━━\n`;
              reportText += `• <b>검토 대상:</b> ${(result.evaluations || []).length}개 종목\n`;
              reportText += `• <b>유효 진입 신호:</b> <b>${actionableSignals.length}건</b>\n`;
              reportText += `• <b>고위험 종목:</b> ${(result.evaluations || []).filter((e: any) => e.risk?.risk_level === 'HIGH').length}개\n\n`;

              if (actionableSignals.length > 0) {
                reportText += `<b>🎯 오늘 포착된 주요 기회 종목:</b>\n`;
                actionableSignals.slice(0, 5).forEach((sig: any, idx: number) => {
                  const arrow = (sig.change1d ?? 0) >= 0 ? '🔺' : '🔻';
                  const changeStr = `${(sig.change1d ?? 0) >= 0 ? '+' : ''}${(sig.change1d ?? 0).toFixed(1)}%`;
                  reportText += `${idx + 1}. <b>${sig.ticker}</b> (${sig.name})\n`;
                  reportText += `   - 현재가: $${(sig.price ?? 0).toFixed(2)} (${arrow} ${changeStr})\n`;
                  reportText += `   - 기회점수: <b>${sig.opportunity?.opportunity_score ?? 50}점</b> | 판정: <code>${sig.decision?.decision || 'BUY'}</code>\n`;
                  reportText += `   - 핵심이유: ${sig.decision?.reason || '기술적 반등 및 팩터 점수 우수'}\n\n`;
                });
              } else {
                reportText += `ℹ️ 현재 엄격한 리스크 제약을 통과한 신규 진입 신호가 없습니다. (안전 자산/현금 비중 유지 권장)\n\n`;
              }

              if (url.origin) {
                reportText += `🔗 <a href="${url.origin}">퀀트 시스템 대시보드 바로가기</a>`;
              }

              const sendRes = await telegramNotifier.sendMessage(reportText, botToken, chatId);
              if (sendRes.success && !sendRes.previewOnly) {
                telegramStatus = {
                  sent: true,
                  message: '텔레그램 발송 완료',
                  target: chatId ? `${chatId.slice(0, 3)}****` : null,
                };
              } else {
                telegramStatus = {
                  sent: false,
                  message: sendRes.error || '텔레그램 발송 실패',
                };
              }
            } catch (tErr: any) {
              console.warn('[WorkerScan] Telegram send error:', tErr);
              telegramStatus = {
                sent: false,
                message: tErr.message || '텔레그램 발송 예외',
              };
            }
          } else {
            telegramStatus = {
              sent: false,
              message: '텔레그램 봇 토큰/챗ID 미등록 (알림 모달에서 등록 필요)',
            };
          }
        }

        return jsonResponse({
          success: true,
          scan_log: runLog,
          new_signals: result.newSignals || [],
          actionable_signals: actionableSignals,
          evaluations_count: (result.evaluations || []).length,
          evaluations: result.evaluations || [],
          telegram_status: telegramStatus,
        });
      } catch (err: any) {
        console.error('[WorkerScan] scan execution error:', err);
        return jsonResponse({
          success: false,
          error: err.message || 'Scan execution failed',
        }, 500);
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

    // ========== Telegram & Cron ==========
    if (path === '/api/v8/telegram/status') {
      const cfg = telegramNotifier.getConfig();
      const envToken = env?.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || cfg.botToken || '';
      const envChatId = env?.TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHAT_ID || cfg.chatId || '';
      return jsonResponse({
        success: true,
        configured: Boolean(envToken && envChatId),
        botTokenConfigured: Boolean(envToken),
        chatIdConfigured: Boolean(envChatId),
        targetChatIdMasked: envChatId ? `${envChatId.slice(0, 3)}****` : null,
        source: (env?.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN) ? 'ENV_VARIABLE' : cfg.botToken ? 'UI_SESSION' : 'UNCONFIGURED',
      });
    }

    if (path === '/api/v8/telegram/config' && method === 'POST') {
      try {
        let body: any = {};
        try { body = await request.json(); } catch {}
        const { botToken, chatId } = body || {};
        telegramNotifier.setConfig(botToken, chatId);
        return jsonResponse({
          success: true,
          message: '텔레그램 봇 연동 정보가 설정되었습니다.',
          status: {
            configured: Boolean(botToken && chatId),
            targetChatIdMasked: chatId ? `${chatId.slice(0, 3)}****` : null,
          }
        });
      } catch (err: any) {
        return jsonResponse({ success: false, error: err.message }, 500);
      }
    }

    if (path === '/api/v8/schedule/status') {
      const nowKST = new Date(Date.now() + 9 * 60 * 60 * 1000);
      const kstHour = nowKST.getUTCHours();
      const kstMinute = nowKST.getUTCMinutes();
      const kstTimeStr = `${String(kstHour).padStart(2, '0')}:${String(kstMinute).padStart(2, '0')} KST`;

      let nextSlot = {
        id: 'PRE_MARKET',
        name: '🌃 프리마켓 갭 분석 & 당일 관심종목 압축',
        target_time: '22:00 KST',
      };
      if (kstHour < 6 || (kstHour === 6 && kstMinute < 30)) {
        nextSlot = { id: 'POST_MARKET', name: '🌅 미국 정규장 마감 브리핑 (종가 확정)', target_time: '06:30 KST' };
      } else if (kstHour < 22) {
        nextSlot = { id: 'PRE_MARKET', name: '🌃 프리마켓 갭 분석 & 당일 관심종목 압축', target_time: '22:00 KST' };
      } else {
        nextSlot = { id: 'INTRADAY', name: '🌙 장중 급변 & 모멘텀 브레이크아웃 감시', target_time: '02:00 KST' };
      }

      return jsonResponse({
        success: true,
        active: true,
        current_kst_time: kstTimeStr,
        last_executed_slot: 'Cloudflare Cron 활성화',
        next_scheduled_slot: nextSlot,
        schedules: [
          { id: 'POST_MARKET', name: '🌅 미국 정규장 마감 브리핑 (종가 확정)', time: '06:30 KST' },
          { id: 'PRE_MARKET', name: '🌃 프리마켓 갭 분석 & 당일 관심종목 압축', time: '22:00 KST' },
          { id: 'INTRADAY', name: '🌙 장중 급변 & 모멘텀 브레이크아웃 감시', time: '02:00 KST' },
        ],
      });
    }

    if (path === '/api/v8/schedule/trigger' && method === 'POST') {
      try {
        const cfg = telegramNotifier.getConfig();
        const botToken = (env?.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || cfg.botToken || '').trim();
        const chatId = (env?.TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHAT_ID || cfg.chatId || '').trim();
        const result = await executeCronScan({
          botToken: botToken || undefined,
          chatId: chatId || undefined,
          triggeredBy: 'ManualTrigger',
          sourceUrl: url.origin,
        });
        return jsonResponse(result);
      } catch (err: any) {
        return jsonResponse({ success: false, error: err.message }, 500);
      }
    }

    if (path === '/api/v8/telegram/test-broadcast' && method === 'POST') {
      try {
        let body: any = {};
        try { body = await request.json(); } catch {}
        let botToken = (env?.TELEGRAM_BOT_TOKEN || body.botToken || '').trim().replace(/^['"]|['"]$/g, '');
        let chatId = (env?.TELEGRAM_CHAT_ID || body.chatId || '').trim().replace(/^['"]|['"]$/g, '');

        if (botToken.toLowerCase().startsWith('bot')) {
          botToken = botToken.substring(3);
        }

        const testMessage =
          `<b>🚨 [퀀트 엔진] 텔레그램 테스트 알림</b>\n` +
          `🕒 발송 시각: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} KST\n` +
          `━━━━━━━━━━━━━━━━━━━━━\n` +
          `✅ <b>연동 상태:</b> 정상 동작 중\n` +
          `📈 <b>샘플 티커:</b> NVDA (NVIDIA Corp)\n` +
          `💡 <b>기회 점수:</b> 84점 (OPPORTUNITY)\n` +
          `🛡️ <b>리스크 등급:</b> LOW (안전 영역)\n` +
          `🎯 <b>결론:</b> 기술적 반등 및 모멘텀 지속에 따른 분할 매수 적합\n\n` +
          `자동 스캔(하루 3회: 06:30, 22:00, 02:00 KST) 시 위와 같은 양식으로 신호가 발송됩니다.`;

        if (!botToken || !chatId) {
          return jsonResponse({
            success: true,
            previewOnly: true,
            message: '텔레그램 봇 토큰/챗 ID 미등록 (프리뷰 모드 동작)',
            previewText: testMessage,
          });
        }

        const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: testMessage,
            parse_mode: 'HTML',
          }),
        });

        const data = await res.json().catch(() => ({}));
        const desc = data.description || '';
        let friendlyMessage = res.ok
          ? '텔레그램 봇으로 실제 테스트 메시지가 발송되었습니다!'
          : `텔레그램 발송 실패: ${desc || '인증 오류'}`;

        if (!res.ok) {
          if (desc.includes('chat not found')) {
            friendlyMessage = `대화방을 찾을 수 없습니다 (${desc}). 텔레그램에서 봇과 1:1 대화방을 열고 '/start' 버튼을 누른 후 다시 시도해주세요.`;
          } else if (desc.includes('bot was blocked') || desc.includes('Forbidden')) {
            friendlyMessage = `봇이 차단되었거나 시작되지 않았습니다 (${desc}). 텔레그램 봇 대화방에서 '시작(Start)' 버튼을 눌러주세요.`;
          } else if (desc.includes('Unauthorized') || desc.includes('invalid token')) {
            friendlyMessage = `봇 토큰(Bot Token)이 올바르지 않습니다 (${desc}). BotFather에서 발급받은 토큰을 다시 확인해주세요.`;
          }
        }

        return jsonResponse({
          success: res.ok,
          previewOnly: false,
          message: friendlyMessage,
          telegramResponse: data,
        });
      } catch (err: any) {
        return jsonResponse({ success: false, error: err.message }, 500);
      }
    }

    // ========== Cron Scan Status Check ==========
    if (
      path === '/api/v8/cron-scan/status' ||
      path === '/api/v8/cron/status' ||
      path === '/api/v8/cron/last-run'
    ) {
      const lastResult = getLastCronScanResult();
      return jsonResponse({
        success: true,
        last_scan: lastResult,
        timestamp: new Date().toISOString(),
      });
    }

    // ========== Cron Scan Webhook ==========
    if (
      path === '/api/v8/cron-scan' ||
      path === '/api/cron-scan' ||
      path === '/api/v8/cron' ||
      path === '/api/cron' ||
      path === '/cron-scan' ||
      path === '/api/v8/scan/cron' ||
      path === '/api/scan/cron'
    ) {
      try {
        const startTime = Date.now();
        const runId = `CRON_${Date.now()}`;

        // Robust query parsing handling multiple '?' (e.g. ?async=true?bot_token=...)
        const rawSearch = url.search ? url.search.substring(1).replace(/\?/g, '&') : '';
        const searchParams = new URLSearchParams(rawSearch);

        // 1. Cron Secret Token Check (Security Gate)
        const secretToken = env?.CRON_SECRET_TOKEN || env?.V8_CRON_SECRET || process.env.CRON_SECRET_TOKEN;
        if (secretToken) {
          const authHeader = request.headers.get('authorization') || '';
          const bearerToken = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.substring(7).trim() : null;
          const providedToken =
            searchParams.get('cron_token') ||
            searchParams.get('token') ||
            searchParams.get('secret') ||
            searchParams.get('key') ||
            request.headers.get('x-cron-token') ||
            bearerToken;

          if (!providedToken || providedToken !== secretToken) {
            return jsonResponse({
              success: false,
              error: 'Unauthorized: Invalid or missing cron secret token',
              timestamp: new Date().toISOString(),
            }, 401);
          }
        }

        // Parse optional query params or body
        let bodyData: any = {};
        if (method === 'POST') {
          try {
            bodyData = await request.json();
          } catch {}
        }

        const botToken = (
          env?.TELEGRAM_BOT_TOKEN ||
          process.env.TELEGRAM_BOT_TOKEN ||
          searchParams.get('bot_token') ||
          searchParams.get('botToken') ||
          searchParams.get('token') ||
          bodyData.botToken ||
          bodyData.bot_token ||
          bodyData.token ||
          request.headers.get('x-telegram-token') ||
          '8979603920:AAGoWWVENKOR18zAG-hJRQb0earF-qkqO3E'
        ).trim().replace(/^['"]|['"]$/g, '').replace(/^bot/i, '');

        const chatId = (
          env?.TELEGRAM_CHAT_ID ||
          process.env.TELEGRAM_CHAT_ID ||
          searchParams.get('chat_id') ||
          searchParams.get('chatId') ||
          searchParams.get('chat') ||
          bodyData.chatId ||
          bodyData.chat_id ||
          bodyData.chat ||
          request.headers.get('x-telegram-chat-id') ||
          '7774679329'
        ).trim().replace(/^['"]|['"]$/g, '');

        // Check if asynchronous background execution is requested (recommended for external cron services to avoid timeouts)
        const isAsync =
          searchParams.get('async') === 'true' ||
          searchParams.get('async') === '1' ||
          bodyData.async === true ||
          searchParams.get('mode') === 'async' ||
          bodyData.mode === 'async';

        if (isAsync && ctx && typeof ctx.waitUntil === 'function') {
          const scanTask = executeCronScan({
            botToken: botToken || undefined,
            chatId: chatId || undefined,
            triggeredBy: 'WorkerHttpWebhookAsync',
            sourceUrl: url.origin,
          }).catch((err) => {
            console.error('[WorkerCronWebhook] Background execution error:', err);
          });

          ctx.waitUntil(scanTask);

          return jsonResponse({
            success: true,
            status: 'ACCEPTED',
            mode: 'async',
            message: '크론 스캔이 백그라운드 태스크로 시작되었습니다. 스캔 완료 시 텔레그램 발송 및 DB 저장이 자동 완료됩니다.',
            telegram_target: chatId ? `${chatId.slice(0, 3)}****` : null,
            timestamp: new Date().toISOString(),
          }, 202);
        }

        // 2. Execute Quant Pipeline synchronously
        const cronResult = await executeCronScan({
          botToken: botToken || undefined,
          chatId: chatId || undefined,
          triggeredBy: 'WorkerHttpWebhook',
          sourceUrl: url.origin,
        });

        return jsonResponse({
          ...cronResult,
          duration_ms: Date.now() - startTime,
        }, cronResult.success ? 200 : 500);
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

  // Cloudflare Workers Native Cron Trigger (Scheduled Event)
  async scheduled(event: any, env: any, ctx: any): Promise<void> {
    await ensureDbConnected(env);
    console.log('[Cloudflare Cron Trigger] Scheduled event triggered:', event?.cron);

    const cfg = telegramNotifier.getConfig();
    const botToken = (env?.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || cfg.botToken || '')
      .trim()
      .replace(/^['"]|['"]$/g, '')
      .replace(/^bot/i, '');
    const chatId = (env?.TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHAT_ID || cfg.chatId || '')
      .trim()
      .replace(/^['"]|['"]$/g, '');

    const scanTask = executeCronScan({
      triggeredBy: `CloudflareCron:${event?.cron || 'scheduled'}`,
      botToken: botToken || undefined,
      chatId: chatId || undefined,
    }).catch((err) => {
      console.error('[Cloudflare Cron Trigger] Execution error:', err);
    });

    if (ctx && typeof ctx.waitUntil === 'function') {
      ctx.waitUntil(scanTask);
    }
    await scanTask;
  },
};
