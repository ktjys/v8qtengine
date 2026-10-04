import { SignalSnapshot } from '../types/v8';
import { buildSignalTelegramMessage, buildScanSummaryTelegramMessage } from './templates';

export function escapeTelegramHtml(text?: string | null): string {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>');
}

export const TELEGRAM_MAX_MESSAGE_LENGTH = 4096;
export const TELEGRAM_SAFE_LENGTH = 3800; // Safety margin

/**
 * Splits a long message into multiple parts that fit within Telegram's 4096 char limit.
 * Tries to split at section boundaries (double newlines) for readability.
 */
export function splitTelegramMessage(text: string): string[] {
  if (text.length <= TELEGRAM_SAFE_LENGTH) {
    return [text];
  }

  const parts: string[] = [];
  let remaining = text;

  while (remaining.length > TELEGRAM_SAFE_LENGTH) {
    let splitIndex = remaining.lastIndexOf('\n\n', TELEGRAM_SAFE_LENGTH);
    if (splitIndex === -1 || splitIndex < TELEGRAM_SAFE_LENGTH * 0.5) {
      splitIndex = remaining.lastIndexOf('\n', TELEGRAM_SAFE_LENGTH);
    }
    if (splitIndex === -1 || splitIndex < TELEGRAM_SAFE_LENGTH * 0.3) {
      splitIndex = TELEGRAM_SAFE_LENGTH;
    }

    const part = remaining.slice(0, splitIndex).trim();
    parts.push(part);
    remaining = remaining.slice(splitIndex).trim();
  }

  if (remaining.length > 0) {
    parts.push(remaining);
  }

  if (parts.length > 1) {
    return parts.map((p, i) => `[${i + 1}/${parts.length}]\n${p}`);
  }
  return parts;
}

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
    this.botToken = sanitizeToken(
      process.env.TELEGRAM_BOT_TOKEN || null
    );
    this.chatId = sanitizeChatId(
      process.env.TELEGRAM_CHAT_ID || null
    );
  }

  setConfig(botToken?: string, chatId?: string) {
    if (botToken !== undefined) this.botToken = sanitizeToken(botToken);
    if (chatId !== undefined) this.chatId = sanitizeChatId(chatId);
    if (this.botToken) process.env.TELEGRAM_BOT_TOKEN = this.botToken;
    if (this.chatId) process.env.TELEGRAM_CHAT_ID = this.chatId;
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

    // Safety guard: Never send live Telegram notifications during unit/integration tests
    if ((process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST)) && !process.env.ALLOW_TEST_TELEGRAM) {
      return {
        success: true,
        previewOnly: true,
      };
    }

    // Auto-split long messages exceeding Telegram's length limit (4096 chars)
    const chunks = splitTelegramMessage(text);
    let lastResult: { success: boolean; previewOnly?: boolean; error?: string } = { success: true };

    for (const chunk of chunks) {
      try {
        const url = `https://api.telegram.org/bot${token}/sendMessage`;
        let res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chat,
            text: chunk,
            parse_mode: 'HTML',
          }),
        });

        let resData = await res.json().catch(() => ({}));

        // Fallback: If Telegram fails due to entity parsing, retry as plain text
        if (!res.ok || !resData.ok) {
          const desc = resData.description || `HTTP ${res.status}`;
          if (desc.includes("can't parse entities") || desc.includes('entity') || desc.includes('tag')) {
            console.warn('[TelegramNotifier] HTML parsing failed, retrying as plain text:', desc);
            const plainText = chunk.replace(/<[^>]*>/g, '');
            res = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: chat,
                text: plainText,
              }),
            });
            resData = await res.json().catch(() => ({}));
          }
        }

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

        lastResult = { success: true };
      } catch (err) {
        console.error('[TelegramNotifier] send error:', err);
        return { success: false, error: (err as Error).message };
      }
    }

    return lastResult;
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