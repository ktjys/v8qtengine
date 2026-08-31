import { Router } from 'express';
import { scanService } from '../pipeline/scanService';
import { dbClient } from '../db/supabaseClient';
import { AssetClassification } from '../types/v8';
import { telegramNotifier } from '../notification/telegramNotifier';

export const scanRouter = Router();

// POST /api/v8/scan/run
scanRouter.post('/run', async (req, res) => {
  try {
    const simulatePartialFailure = req.body.simulate_partial_failure === true;
    const providerType = req.body.provider_type as 'yahoo' | 'seed' | undefined;
    const sendTelegram = req.body.send_telegram !== false; // 기본값 true

    const manualOverrides: Record<string, AssetClassification> = {};
    for (const [k, v] of dbClient.classifications.entries()) {
      manualOverrides[k] = v;
    }

    const result = await scanService.executeScan(
      { simulatePartialFailure, providerType, saveToDb: true },
      manualOverrides
    );

    const actionableSignals = result.evaluations.filter(
      (ev) => ev.signal_generated
    );

    // 텔레그램 알림 발송 (텔레그램 설정이 되어있는 경우)
    let telegramStatus: { sent: boolean; message: string } = {
      sent: false,
      message: '텔레그램 미전송',
    };

    if (sendTelegram && telegramNotifier.isConfigured()) {
      try {
        const kstTimeStr = new Intl.DateTimeFormat('ko-KR', {
          timeZone: 'Asia/Seoul',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }).format(new Date());

        let reportText = `<b>🚀 퀀트 스캐너 실행 완료 리포트</b>\n`;
        reportText += `🕒 <b>실행 시각:</b> ${kstTimeStr} (KST)\n`;
        reportText += `━━━━━━━━━━━━━━━━━━━━━\n`;
        reportText += `• <b>검토 대상:</b> ${result.evaluations.length}개 종목\n`;
        reportText += `• <b>유효 진입 신호:</b> <b>${actionableSignals.length}건</b>\n`;
        reportText += `• <b>고위험 종목:</b> ${result.evaluations.filter((e) => e.risk?.risk_level === 'HIGH').length}개\n\n`;

        if (actionableSignals.length > 0) {
          reportText += `<b>🎯 오늘 포착된 주요 기회 종목:</b>\n`;
          actionableSignals.slice(0, 5).forEach((sig, idx) => {
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

        const host = req.get('host');
        if (host) {
          reportText += `🔗 <a href="${req.protocol}://${host}">퀀트 시스템 대시보드 바로가기</a>`;
        }

        const sendRes = await telegramNotifier.sendMessage(reportText);
        if (sendRes.success && !sendRes.previewOnly) {
          telegramStatus = { sent: true, message: '텔레그램 발송 완료' };
        } else {
          telegramStatus = { sent: false, message: sendRes.error || '텔레그램 발송 실패' };
        }
      } catch (tErr) {
        console.warn('[ScanRoute] Telegram send warning:', tErr);
        telegramStatus = { sent: false, message: (tErr as Error).message };
      }
    }

    res.json({
      success: true,
      scan_log: result.runLog,
      new_signals: result.newSignals,
      actionable_signals: actionableSignals,
      evaluations_count: result.evaluations.length,
      evaluations: result.evaluations,
      telegram_status: telegramStatus,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});
