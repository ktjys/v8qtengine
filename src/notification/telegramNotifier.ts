import { SignalSnapshot } from '../types/v8';
import { buildSignalTelegramMessage, buildScanSummaryTelegramMessage } from './templates';

export class TelegramNotifier {
  private botToken: string | null = null;
  private chatId: string | null = null;

  constructor() {
    this.botToken = process.env.TELEGRAM_BOT_TOKEN || null;
    this.chatId = process.env.TELEGRAM_CHAT_ID || null;
  }

  setConfig(botToken?: string, chatId?: string) {
    if (botToken) this.botToken = botToken.trim();
    if (chatId) this.chatId = chatId.trim();
  }

  getConfig() {
    return {
      botToken: this.botToken,
      chatId: this.chatId,
      isConfigured: this.isConfigured(),
    };
  }

  isConfigured(): boolean {
    return Boolean(this.botToken && this.chatId);
  }

  async sendMessage(text: string, customToken?: string, customChatId?: string): Promise<{ success: boolean; previewOnly?: boolean; error?: string }> {
    const token = customToken || this.botToken;
    const chat = customChatId || this.chatId;

    if (!token || !chat) {
      return {
        success: true,
        previewOnly: true,
      };
    }

    try {
      const url = `https://api.telegram.org/bot${token}/sendMessage`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chat,
          text,
          parse_mode: 'HTML',
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.description || `Telegram API returned HTTP ${res.status}`);
      }

      return { success: true };
    } catch (err) {
      console.error('[TelegramNotifier] send error:', err);
      return { success: false, error: (err as Error).message };
    }
  }

  async sendSignalAlert(snapshot: SignalSnapshot) {
    const text = buildSignalTelegramMessage(snapshot);
    return this.sendMessage(text);
  }

  async sendScanSummary(evaluatedCount: number, signalCount: number, failureCount: number) {
    const text = buildScanSummaryTelegramMessage(evaluatedCount, signalCount, failureCount);
    return this.sendMessage(text);
  }
}

export const telegramNotifier = new TelegramNotifier();
