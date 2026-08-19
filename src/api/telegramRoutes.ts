import { Router } from 'express';
import { telegramNotifier } from '../notification/telegramNotifier';
import { signalRepository } from '../db/repositories/signalRepository';

export const telegramRouter = Router();

// GET /api/v8/telegram/status
telegramRouter.get('/status', (req, res) => {
  res.json({
    success: true,
    configured: telegramNotifier.isConfigured(),
    botTokenConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN),
    chatIdConfigured: Boolean(process.env.TELEGRAM_CHAT_ID),
  });
});

// POST /api/v8/telegram/test-broadcast
telegramRouter.post('/test-broadcast', async (req, res) => {
  try {
    const signals = await signalRepository.getAll();
    const testSignal = signals.length > 0 ? signals[0] : null;

    if (!testSignal) {
      return res.status(400).json({ error: 'No signal available to broadcast' });
    }

    const sendRes = await telegramNotifier.sendSignalAlert(testSignal);
    res.json({
      success: true,
      result: sendRes,
      previewOnly: sendRes.previewOnly,
      message: sendRes.previewOnly
        ? '텔레그램 환경변수(TELEGRAM_BOT_TOKEN / CHAT_ID) 미설정 상태로 Preview 검증 완료'
        : '텔레그램 봇으로 실제 알림이 발송되었습니다.',
    });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});
