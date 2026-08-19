import { SignalSnapshot } from '../types/v8';
import { buildSignalTelegramMessage, buildScanSummaryTelegramMessage } from './templates';

export class TelegramNotifier {
  private botToken: string | null = null;
  private chatId: string | null = null;

  constructor() {
    this.botToken = process.env.TELEGRAM_BOT_TOKEN || null;
    this.chatId = process.env.TELEGRAM_CHAT_ID || null;
  }

  isConfigured(): boolean {
    return Boolean(this.botToken && this.chatId);
  }

  async sendMessage(text: string): Promise<{ success: boolean; previewOnly?: boolean; error?: string }> {
    if (!this.isConfigured()) {
      return {
        success: true,
        previewOnly: true,
      };
    }

    try {
      const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.chatId,
          text,
          parse_mode: 'HTML',
        }),
      });

      if (!res.ok) {
        throw new Error(`Telegram API returned HTTP ${res.status}`);
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
