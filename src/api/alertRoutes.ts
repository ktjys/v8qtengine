import { Router } from 'express';
import { alertHistoryRepository } from '../db/repositories/alertHistoryRepository';

export const alertRouter = Router();

// GET /api/v8/alerts
alertRouter.get('/', async (req, res) => {
  try {
    const { ticker, strategy } = req.query;

    let alerts = await alertHistoryRepository.getAll();

    if (ticker && typeof ticker === 'string') {
      const clean = ticker.toUpperCase().trim();
      alerts = alerts.filter((a) => a.tickers.map((t) => t.toUpperCase()).includes(clean));
    }

    if (strategy && typeof strategy === 'string' && strategy !== 'ALL') {
      if (strategy === 'STRATEGY_B') {
        alerts = alerts.filter(
          (a) =>
            a.strategy_type === 'STRATEGY_B' ||
            (a.details?.strategy_b_tickers && a.details.strategy_b_tickers.length > 0)
        );
      } else if (strategy === 'STRATEGY_A') {
        alerts = alerts.filter(
          (a) =>
            a.strategy_type === 'STRATEGY_A' ||
            (a.details?.strategy_a_tickers && a.details.strategy_a_tickers.length > 0)
        );
      } else {
        alerts = alerts.filter((a) => a.strategy_type === strategy);
      }
    }

    res.json({
      success: true,
      alerts,
      totalCount: alerts.length,
    });
  } catch (err: any) {
    console.error('[AlertRoutes] GET error:', err);
    res.status(500).json({
      success: false,
      error: err.message || '알림 발송 내역 조회 실패',
      alerts: [],
    });
  }
});

// POST /api/v8/alerts
alertRouter.post('/', async (req, res) => {
  try {
    const alertData = req.body;
    if (!alertData || !alertData.title) {
      return res.status(400).json({ success: false, error: '유효한 알림 데이터가 누락되었습니다.' });
    }

    const saved = await alertHistoryRepository.save(alertData);
    res.json({ success: true, alert: saved });
  } catch (err: any) {
    console.error('[AlertRoutes] POST error:', err);
    res.status(500).json({
      success: false,
      error: err.message || '알림 저장 실패',
    });
  }
});

// DELETE /api/v8/alerts
alertRouter.delete('/', async (req, res) => {
  try {
    await alertHistoryRepository.clearAll();
    res.json({ success: true, message: '알림 발송 이력이 초기화되었습니다.' });
  } catch (err: any) {
    console.error('[AlertRoutes] DELETE error:', err);
    res.status(500).json({
      success: false,
      error: err.message || '알림 이력 초기화 실패',
    });
  }
});
