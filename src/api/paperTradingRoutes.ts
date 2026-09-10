import express from 'express';
import { PaperTradingEngine } from '../engine/paperTradingEngine';

export const paperTradingRouter = express.Router();

/**
 * GET /api/v8/paper/summary
 * 가상 계좌 요약 (예수금, 평가손익, 보유 포지션, 체결 내역)
 */
paperTradingRouter.get('/summary', (req, res) => {
  try {
    const summary = PaperTradingEngine.getAccountSummary();
    return res.json({ success: true, summary });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch paper account' });
  }
});

/**
 * POST /api/v8/paper/order
 * 모의투자 매수/매도 주문 실행
 */
paperTradingRouter.post('/order', (req, res) => {
  try {
    const { ticker, companyName, orderType, shares, price, strategySource, reason } = req.body;
    if (!ticker || !orderType || !shares || !price) {
      return res.status(400).json({
        success: false,
        error: '필수 파라미터(ticker, orderType, shares, price)가 누락되었습니다.',
      });
    }

    const result = PaperTradingEngine.executeOrder({
      ticker: String(ticker).toUpperCase(),
      companyName: companyName ? String(companyName) : undefined,
      orderType: orderType === 'SELL' ? 'SELL' : 'BUY',
      shares: Number(shares),
      price: Number(price),
      strategySource,
      reason,
    });

    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }

    const updatedSummary = PaperTradingEngine.getAccountSummary();
    return res.json({
      success: true,
      order: result.order,
      summary: updatedSummary,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Order execution failed',
    });
  }
});

/**
 * POST /api/v8/paper/reset
 * 가상 계좌 초기화
 */
paperTradingRouter.post('/reset', (req, res) => {
  try {
    const capital = req.body.initialCapital ? Number(req.body.initialCapital) : 100000;
    const summary = PaperTradingEngine.resetAccount(capital);
    return res.json({ success: true, summary });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to reset paper account' });
  }
});

/**
 * GET /api/v8/paper/accuracy
 * 시그널 사후 성과 & 적중률 (Win Rate, MFE, MAE)
 */
paperTradingRouter.get('/accuracy', (req, res) => {
  try {
    const performance = PaperTradingEngine.getSignalPerformanceSummary();
    return res.json({ success: true, performance });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch signal accuracy' });
  }
});
