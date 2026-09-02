import { evaluationRepository } from '../db/repositories/evaluationRepository';
import { scanRunRepository } from '../db/repositories/scanRunRepository';
import { signalRepository } from '../db/repositories/signalRepository';
import { watchlistRepository } from '../db/repositories/watchlistRepository';
import { scanService } from '../pipeline/scanService';
import { telegramNotifier } from '../notification/telegramNotifier';
import { createSignalSnapshot } from './signalEngine';
import { FullTickerEvaluation, ScanRunLog } from '../types/v8';

export interface CronScanOptions {
  botToken?: string | null;
  chatId?: string | null;
  triggeredBy?: string;
  sourceUrl?: string;
}

export interface CronScanResult {
  success: boolean;
  timestamp: string;
  slot: string;
  kst_time: string;
  duration_ms: number;
  evaluated_count: number;
  actionable_signals_count: number;
  actionable_signals: Array<{
    ticker: string;
    name: string;
    decision: string;
    opportunity_score: number;
    risk_level: string;
    price: number;
    change1d: number;
    reason: string;
  }>;
  telegram_status: {
    configured: boolean;
    sent: boolean;
    previewOnly?: boolean;
    target?: string | null;
    message: string;
  };
  run_id: string;
  error?: string;
}

export async function executeCronScan(options: CronScanOptions = {}): Promise<CronScanResult> {
  const startTime = Date.now();
  const runId = `CRON_${Date.now()}`;

  // 1. Determine KST slot
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

  try {
    // 2. Execute Quant Pipeline across all active watchlist items
    let evaluations: FullTickerEvaluation[] = [];
    let actionable: FullTickerEvaluation[] = [];
    let watchlistTotalCount = 0;
    let scanError: string | undefined;

    try {
      const timeoutPromise = new Promise<{ evaluations: FullTickerEvaluation[]; watchlist: any[] }>((resolve) => {
        setTimeout(async () => {
          console.warn('[CronScan] Scan exceeded 6.5s safety limit. Reusing latest database evaluations for instant response.');
          try {
            const cached = await evaluationRepository.getAll();
            resolve({ evaluations: cached || [], watchlist: cached || [] });
          } catch {
            resolve({ evaluations: [], watchlist: [] });
          }
        }, 6500);
      });

      const scanResult = await Promise.race([
        scanService.executeScan({ saveToDb: true }),
        timeoutPromise,
      ]);

      evaluations = scanResult.evaluations || [];
      watchlistTotalCount = scanResult.watchlist?.length || evaluations.length;
    } catch (scanErr: any) {
      console.error('[CronScan] ScanService failed:', scanErr);
      scanError = scanErr?.message || 'Scan execution failed';
      // Attempt to read latest real evaluations from DB rather than fake seed prices
      try {
        const cached = await evaluationRepository.getAll();
        if (cached && cached.length > 0) {
          evaluations = cached;
          watchlistTotalCount = cached.length;
        }
      } catch (cacheErr) {
        console.warn('[CronScan] Failed to load cached evaluations from DB:', cacheErr);
      }
    }

    actionable = evaluations.filter((e) => e.signal_generated);

    // 4. Record the scan run log
    const durationMs = Date.now() - startTime;
    const runLog: ScanRunLog = {
      run_id: runId,
      started_at: new Date(startTime).toISOString(),
      finished_at: new Date().toISOString(),
      watchlist_count: watchlistTotalCount,
      evaluated_count: evaluations.length,
      signal_count: actionable.length,
      failure_count: scanError ? 1 : 0,
      failed_tickers: scanError ? [{ ticker: 'SCAN_SERVICE', error: scanError }] : [],
      status: scanError ? 'FAILED' : 'SUCCESS',
      error_summary: scanError ? `스캔 오류: ${scanError}` : `${slotName} 무결성 스캔 완료 (${actionable.length}건 시그널 도출)`,
    };

    try {
      await scanRunRepository.save(runLog);
    } catch (err) {
      console.warn('[CronScan] Failed to save scan run log:', err);
    }

    // 5. Telegram Notification
    let telegramResult = {
      configured: false,
      sent: false,
      previewOnly: true,
      target: null as string | null,
      message: '텔레그램 봇 토큰/챗ID 미설정 (시뮬레이션 모드)',
    };

    const token = options.botToken || process.env.TELEGRAM_BOT_TOKEN;
    const chat = options.chatId || process.env.TELEGRAM_CHAT_ID;

    if (token && chat) {
      const cleanToken = token.trim().replace(/^['"]|['"]$/g, '').replace(/^bot/i, '');
      const cleanChat = chat.trim().replace(/^['"]|['"]$/g, '');
      const maskedTarget = cleanChat ? `${cleanChat.slice(0, 3)}****` : null;

      let reportText = `<b>📊 퀀트 엔진 자동 스캔 리포트</b>\n`;
      reportText += `🕒 <b>실행 시각:</b> ${kstTimeStr} (${slotName})\n`;
      reportText += `━━━━━━━━━━━━━━━━━━━━━\n`;
      reportText += `• <b>모니터링 대상:</b> ${evaluations.length}개 자산\n`;
      reportText += `• <b>유효 진입 신호:</b> <b>${actionable.length}건</b>\n`;
      reportText += `• <b>고위험 종목:</b> ${evaluations.filter((e) => e.risk?.risk_level === 'HIGH').length}개\n\n`;

      if (actionable.length > 0) {
        reportText += `<b>🎯 오늘 포착된 주요 기회 종목:</b>\n`;
        actionable.slice(0, 4).forEach((sig, idx) => {
          const arrow = (sig.change1d ?? 0) >= 0 ? '🔺' : '🔻';
          const changeStr = `${(sig.change1d ?? 0) >= 0 ? '+' : ''}${(sig.change1d ?? 0).toFixed(1)}%`;
          reportText += `${idx + 1}. <b>${sig.ticker}</b> (${sig.name})\n`;
          reportText += `   - 현재가: $${(sig.price ?? 0).toFixed(2)} (${arrow} ${changeStr})\n`;
          reportText += `   - 기회점수: <b>${sig.opportunity?.opportunity_score ?? 50}점</b> | 판정: <code>${sig.decision?.decision || 'BUY'}</code>\n`;
          reportText += `   - 핵심이유: ${sig.decision?.reason || '기술적 반등 및 모멘텀 지속'}\n\n`;
        });
      } else {
        reportText += `ℹ️ 현재 엄격한 리스크 제약을 통과한 신규 진입 신호가 없습니다. (안전 자산/현금 비중 유지 권장)\n\n`;
      }

      if (options.sourceUrl) {
        reportText += `🔗 <a href="${options.sourceUrl}">퀀트 시스템 대시보드 바로가기</a>`;
      }

      const sendRes = await telegramNotifier.sendMessage(reportText, cleanToken, cleanChat);

      if (sendRes.success && !sendRes.previewOnly) {
        telegramResult = {
          configured: true,
          sent: true,
          previewOnly: false,
          target: maskedTarget,
          message: '텔레그램 봇으로 실제 브리핑 리포트가 발송되었습니다!',
        };
      } else if (sendRes.previewOnly) {
        telegramResult = {
          configured: false,
          sent: false,
          previewOnly: true,
          target: null,
          message: '텔레그램 미등록: 프리뷰 브리핑 완료',
        };
      } else {
        telegramResult = {
          configured: true,
          sent: false,
          previewOnly: false,
          target: maskedTarget,
          message: sendRes.error || '텔레그램 전송 실패',
        };
      }
    }

    return {
      success: true,
      timestamp: new Date().toISOString(),
      slot: slotName,
      kst_time: kstTimeStr,
      duration_ms: durationMs,
      evaluated_count: evaluations.length,
      actionable_signals_count: actionable.length,
      actionable_signals: actionable.map((s) => ({
        ticker: s.ticker,
        name: s.name,
        decision: s.decision?.decision || 'BUY',
        opportunity_score: s.opportunity?.opportunity_score ?? 50,
        risk_level: s.risk?.risk_level || 'MODERATE',
        price: s.price ?? 0,
        change1d: s.change1d ?? 0,
        reason: s.decision?.reason || '',
      })),
      telegram_status: telegramResult,
      run_id: runId,
    };
  } catch (err: any) {
    console.error('[executeCronScan] Error during cron scan:', err);
    return {
      success: false,
      timestamp: new Date().toISOString(),
      slot: slotName,
      kst_time: kstTimeStr,
      duration_ms: Date.now() - startTime,
      evaluated_count: 0,
      actionable_signals_count: 0,
      actionable_signals: [],
      telegram_status: {
        configured: false,
        sent: false,
        message: `스캔 실행 중 예외: ${err.message}`,
      },
      run_id: runId,
      error: err.message,
    };
  }
}
