import { Router } from 'express';
import { MacroEarningsEngine } from '../engine/macroEarningsEngine';

export const macroRouter = Router();

// GET /api/v8/macro/regime
macroRouter.get('/regime', async (req, res) => {
  try {
    const forceRefresh = req.query.refresh === 'true';
    const regime = await MacroEarningsEngine.getMacroMarketRegime(forceRefresh);
    res.json({
      success: true,
      regime,
    });
  } catch (err: any) {
    console.error('[MacroRoutes] GET /regime error:', err);
    res.status(500).json({
      success: false,
      error: err.message || '매크로 시장 체제 데이터 조회 실패',
    });
  }
});

// GET /api/v8/macro/earnings
macroRouter.get('/earnings', (req, res) => {
  try {
    const { refDate } = req.query;
    const events = MacroEarningsEngine.getEarningsCalendar(
      typeof refDate === 'string' ? refDate : undefined
    );
    res.json({
      success: true,
      events,
      totalCount: events.length,
      imminentCount: events.filter((e) => e.riskStage === 'IMMINENT_DANGER').length,
    });
  } catch (err: any) {
    console.error('[MacroRoutes] GET /earnings error:', err);
    res.status(500).json({
      success: false,
      error: err.message || '실적 캘린더 조회 실패',
    });
  }
});

// GET /api/v8/macro/earnings/:ticker
macroRouter.get('/earnings/:ticker', (req, res) => {
  try {
    const { ticker } = req.params;
    const { refDate } = req.query;
    const event = MacroEarningsEngine.getEarningsRiskForTicker(
      ticker,
      typeof refDate === 'string' ? refDate : undefined
    );

    if (!event) {
      return res.status(404).json({
        success: false,
        error: `${ticker} 종목의 실적 일정을 찾을 수 없습니다.`,
      });
    }

    res.json({
      success: true,
      event,
    });
  } catch (err: any) {
    console.error(`[MacroRoutes] GET /earnings/${req.params.ticker} error:`, err);
    res.status(500).json({
      success: false,
      error: err.message || '종목 실적 일정 조회 실패',
    });
  }
});

// POST /api/v8/macro/refresh
macroRouter.post('/refresh', async (req, res) => {
  try {
    const regime = await MacroEarningsEngine.getMacroMarketRegime(true);
    res.json({
      success: true,
      message: '매크로 시장 체제 데이터가 성공적으로 갱신되었습니다.',
      regime,
    });
  } catch (err: any) {
    console.error('[MacroRoutes] POST /refresh error:', err);
    res.status(500).json({
      success: false,
      error: err.message || '매크로 데이터 갱신 실패',
    });
  }
});
