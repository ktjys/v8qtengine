import { describe, it, expect, beforeEach } from 'vitest';
import { alertHistoryRepository } from './alertHistoryRepository';
import { AlertNotificationLog } from '../../types/v8';

describe('alertHistoryRepository', () => {
  it('returns seeded alert notifications on initial query', async () => {
    const alerts = await alertHistoryRepository.getAll();
    expect(alerts.length).toBeGreaterThanOrEqual(1);
    expect(alerts.some((a) => a.strategy_type === 'STRATEGY_B')).toBe(true);
  });

  it('saves a new Strategy B alert and queries it by ticker', async () => {
    const newAlert: AlertNotificationLog = {
      id: `alert-test-${Date.now()}`,
      timestamp: new Date().toISOString(),
      kst_time: '2026-09-10 12:00:00',
      strategy_type: 'STRATEGY_B',
      title: '테스트 전략 B 눌림목 알림',
      tickers: ['NVDA'],
      signals_count: 1,
      delivery_status: 'SENT',
      delivery_target: '682****',
      message_preview: 'NVDA 눌림목 적립 신호',
      message_body: '<b>NVDA</b> 눌림목 매수',
      details: {
        strategy_b_tickers: [
          {
            ticker: 'NVDA',
            tier: 'S',
            dip_score: 85,
            rsi: 41,
            drawdown: '-5.4%',
            suggested_action: '1.5x 적극 적립',
          },
        ],
      },
    };

    await alertHistoryRepository.save(newAlert);
    const nvdaAlerts = await alertHistoryRepository.getByTicker('NVDA');
    expect(nvdaAlerts.some((a) => a.id === newAlert.id)).toBe(true);
  });
});
