import express from 'express';
import { PortfolioEngine } from '../engine/portfolioEngine';
import { MacroEarningsEngine } from '../engine/macroEarningsEngine';

export const portfolioRouter = express.Router();

/**
 * GET /api/v8/portfolio/state
 * 포트폴리오 자산배분, 섹터 쏠림도, 상관관계 매트릭스, 리밸런싱 주문 가이드
 */
portfolioRouter.get('/state', async (req, res) => {
  try {
    const capitalParam = req.query.capital ? Number(req.query.capital) : undefined;
    const macroRegime = await MacroEarningsEngine.getMacroMarketRegime();
    const state = PortfolioEngine.calculatePortfolioState(capitalParam, macroRegime);

    return res.json({
      success: true,
      state,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[PortfolioRoutes] Error calculating state:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown portfolio error',
    });
  }
});

/**
 * GET /api/v8/portfolio/correlation
 * 상관관계 매트릭스 및 고상관 자산 쌍 조회
 */
portfolioRouter.get('/correlation', (req, res) => {
  try {
    const highPairs = PortfolioEngine.getHighCorrelationPairs();
    return res.json({
      success: true,
      highCorrelationPairs: highPairs,
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch correlation' });
  }
});
