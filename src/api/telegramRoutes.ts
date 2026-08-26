import { Router } from 'express';
import { telegramNotifier } from '../notification/telegramNotifier';
import { signalRepository } from '../db/repositories/signalRepository';

export const telegramRouter = Router();

// GET /api/v8/telegram/status
telegramRouter.get('/status', (req, res) => {
  const cfg = telegramNotifier.getConfig();
  const envToken = process.env.TELEGRAM_BOT_TOKEN;
  const envChatId = process.env.TELEGRAM_CHAT_ID;

  const botToken = cfg.botToken || envToken || '';
  const chatId = cfg.chatId || envChatId || '';

  res.json({
    success: true,
    configured: Boolean(botToken && chatId),
    botTokenConfigured: Boolean(botToken),
    chatIdConfigured: Boolean(chatId),
    targetChatIdMasked: chatId ? `${chatId.slice(0, 3)}****` : null,
    source: cfg.botToken ? 'UI_SAVED' : envToken ? 'ENV_VARIABLE' : 'UNCONFIGURED',
  });
});

// POST /api/v8/telegram/config
telegramRouter.post('/config', (req, res) => {
  const { botToken, chatId } = req.body || {};
  if (botToken) process.env.TELEGRAM_BOT_TOKEN = botToken.trim();
  if (chatId) process.env.TELEGRAM_CHAT_ID = chatId.trim();

  telegramNotifier.setConfig(botToken, chatId);

  res.json({
    success: true,
    message: '텔레그램 봇 연동 정보가 설정되었습니다.',
    status: {
      configured: telegramNotifier.isConfigured(),
      botTokenConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN),
      chatIdConfigured: Boolean(process.env.TELEGRAM_CHAT_ID),
    },
  });
});

// POST /api/v8/telegram/test-broadcast
telegramRouter.post('/test-broadcast', async (req, res) => {
  try {
    const { botToken: customToken, chatId: customChatId } = req.body || {};
    if (customToken || customChatId) {
      telegramNotifier.setConfig(customToken, customChatId);
    }

    const testMessage =
      `<b>🚨 [퀀트 엔진] 텔레그램 테스트 알림</b>\n` +
      `🕒 발송 시각: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} KST\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `✅ <b>연동 상태:</b> 정상 발송 확인 완료\n` +
      `📈 <b>샘플 티커:</b> NVDA (NVIDIA Corp)\n` +
      `💡 <b>기회 점수:</b> 84점 (OPPORTUNITY)\n` +
      `🛡️ <b>리스크 등급:</b> LOW (안전 영역)\n` +
      `🎯 <b>결론:</b> 기술적 반등 및 모멘텀 지속에 따른 분할 매수 적합\n\n` +
      `하루 3회 자동 스캔(06:30, 22:00, 02:00 KST) 시 위와 동일한 양식으로 실시간 브리핑이 발송됩니다.`;

    const sendRes = await telegramNotifier.sendMessage(testMessage, customToken, customChatId);

    if (sendRes.previewOnly) {
      res.json({
        success: true,
        previewOnly: true,
        message: '텔레그램 봇 토큰/챗 아이디가 미등록되어 프리뷰 모드로 시뮬레이션되었습니다.',
        previewText: testMessage,
      });
    } else if (!sendRes.success) {
      res.status(400).json({
        success: false,
        error: sendRes.error || '텔레그램 메시지 발송 실패',
      });
    } else {
      res.json({
        success: true,
        previewOnly: false,
        message: '텔레그램 봇으로 실제 테스트 메시지가 전송되었습니다!',
      });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

