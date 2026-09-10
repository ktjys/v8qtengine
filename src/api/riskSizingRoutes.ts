import express from 'express';
import { RiskSizingEngine } from '../engine/riskSizingEngine';
import { ATRRiskLevel } from '../types/v8';

export const riskSizingRouter = express.Router();

/**
 * GET /api/v8/risk/profile
 * 특정 종목의 ATR 기반 동적 손절선, 2R/3R 익절선, 트레일링 스탑 프로필
 */
riskSizingRouter.get('/profile', (req, res) => {
  try {
    const ticker = String(req.query.ticker || 'NVDA').toUpperCase();
    const price = Number(req.query.price || 118.6);
    const level = (req.query.level as ATRRiskLevel) || 'STANDARD';

    const profile = RiskSizingEngine.calculateATRRiskProfile(ticker, price, level);
    return res.json({ success: true, profile });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to calculate ATR risk profile' });
  }
});

/**
 * POST /api/v8/risk/sizing
 * 계좌 잔고 및 1회 거래 손실 감수율 기준 적정 주문 수량 역산
 */
riskSizingRouter.post('/sizing', (req, res) => {
  try {
    const {
      ticker = 'NVDA',
      entryPrice,
      stopLossPrice,
      accountEquity,
      riskTolerancePct,
      maxAccountAllocationPct,
    } = req.body;

    if (!entryPrice || !stopLossPrice) {
      return res.status(400).json({
        success: false,
        error: 'entryPrice and stopLossPrice are required',
      });
    }

    const sizing = RiskSizingEngine.calculatePositionSize({
      ticker: String(ticker).toUpperCase(),
      entryPrice: Number(entryPrice),
      stopLossPrice: Number(stopLossPrice),
      accountEquity: accountEquity ? Number(accountEquity) : undefined,
      riskTolerancePct: riskTolerancePct ? Number(riskTolerancePct) : undefined,
      maxAccountAllocationPct: maxAccountAllocationPct ? Number(maxAccountAllocationPct) : undefined,
    });

    return res.json({ success: true, sizing });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to calculate position sizing' });
  }
});
