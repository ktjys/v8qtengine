import { SignalSnapshot } from '../types/v8';
import { telegramNotifier } from './telegramNotifier';
import { buildSignalTelegramMessage } from './templates';

export class NotificationService {
  async notifySignal(snapshot: SignalSnapshot) {
    return telegramNotifier.sendSignalAlert(snapshot);
  }

  formatPreview(snapshot: SignalSnapshot): string {
    return buildSignalTelegramMessage(snapshot);
  }
}

export const notificationService = new NotificationService();
