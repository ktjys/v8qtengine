import { SignalSnapshot } from '../types/v8';
import { buildSignalTelegramMessage, buildScanSummaryTelegramMessage } from './templates';

function sanitizeToken(token?: string | null): string | null {
  if (!token) return null;
  let clean = token.trim().replace(/^['"]|['"]$/g, '');
  if (clean.toLowerCase().startsWith('bot')) {
    clean = clean.substring(3);
  }
  return clean || null;
}

function sanitizeChatId(chatId?: string | null): string | null {
  if (!chatId) return null;
  return chatId.trim().replace(/^['"]|['"]$/g, '') || null;
}

export class TelegramNotifier {
  private botToken: string | null = null;
  private chatId: string | null = null;

  constructor() {
    this.botToken = sanitizeToken(process.env.TELEGRAM_BOT_TOKEN || null);
    this.chatId = sanitizeChatId(process.env.TELEGRAM_CHAT_ID || null);
  }

  setConfig(botToken?: string, chatId?: string) {
    if (botToken !== undefined) this.botToken = sanitizeToken(botToken);
    if (chatId !== undefined) this.chatId = sanitizeChatId(chatId);
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
    const token = sanitizeToken(customToken) || this.botToken;
    const chat = sanitizeChatId(customChatId) || this.chatId;

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

      const resData = await res.json().catch(() => ({}));

      if (!res.ok || !resData.ok) {
        const desc = resData.description || `HTTP ${res.status}`;
        let friendlyMessage = `텔레그램 발송 실패: ${desc}`;
        if (desc.includes('chat not found') || desc.includes('Bad Request: chat not found')) {
          friendlyMessage = `대화방을 찾을 수 없습니다 (${desc}). 텔레그램에서 봇과 1:1 대화방을 열고 '/start' 버튼을 누른 후 다시 시도해주세요.`;
        } else if (desc.includes('bot was blocked') || desc.includes('Forbidden')) {
          friendlyMessage = `봇이 차단되었거나 시작되지 않았습니다 (${desc}). 텔레그램 봇 대화방에서 '시작(Start)' 버튼을 눌러주세요.`;
        } else if (desc.includes('Unauthorized') || desc.includes('invalid token')) {
          friendlyMessage = `봇 토큰(Bot Token)이 올바르지 않습니다 (${desc}). BotFather에서 발급받은 토큰을 다시 확인해주세요.`;
        }
        return { success: false, error: friendlyMessage };
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
