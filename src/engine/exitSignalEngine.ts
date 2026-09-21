import {
  FullTickerEvaluation,
  IntegratedExitEvaluation,
  SellSignalType,
  SellUrgency,
  UserHoldPosition,
  ExitSignalDetail,
} from '../types/v8';

export const USER_HOLD_POSITIONS_STORAGE_KEY = 'v8_quant_user_hold_positions';

export class ExitSignalEngine {
  /**
   * 로컬 스토리지에 저장된 사용자 보유 종목 목록 조회
   */
  public static getUserPositions(): UserHoldPosition[] {
    try {
      const stored = localStorage.getItem(USER_HOLD_POSITIONS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (err) {
      console.warn('[ExitSignalEngine] Failed to load user hold positions:', err);
    }
    // 기본 샘플 데이터 (사용자가 보유 중인 핵심 주식 예시)
    return [
      {
        id: 'hold_nvda',
        ticker: 'NVDA',
        name: 'NVIDIA Corp',
        entryPrice: 118.5,
        shares: 20,
        entryDate: '2026-06-15',
        targetTakeProfitPct: 20,
        stopLossPct: -7,
        trailingStopPct: -7,
        highestPrice: 140.2,
        memo: '2분기 실적 발표 전 진입',
        created_at: new Date().toISOString(),
      },
      {
        id: 'hold_tsla',
        ticker: 'TSLA',
        name: 'Tesla Inc',
        entryPrice: 220.0,
        shares: 15,
        entryDate: '2026-07-02',
        targetTakeProfitPct: 15,
        stopLossPct: -7,
        trailingStopPct: -8,
        highestPrice: 238.5,
        memo: '로보택시 모멘텀 분할매수',
        created_at: new Date().toISOString(),
      },
      {
        id: 'hold_spy',
        ticker: 'SPY',
        name: 'SPDR S&P 500 ETF Trust',
        entryPrice: 535.0,
        shares: 10,
        entryDate: '2026-05-10',
        targetTakeProfitPct: 12,
        stopLossPct: -5,
        trailingStopPct: -5,
        highestPrice: 565.0,
        memo: '코어 인덱스 장기 적립',
        created_at: new Date().toISOString(),
      },
    ];
  }

  /**
   * 사용자 보유 종목 목록 저장
   */
  public static saveUserPositions(positions: UserHoldPosition[]): void {
    try {
      localStorage.setItem(USER_HOLD_POSITIONS_STORAGE_KEY, JSON.stringify(positions));
    } catch (err) {
      console.error('[ExitSignalEngine] Failed to save user positions:', err);
    }
  }

  /**
   * 단일 종목에 대해 4대 퀀트 매도 규칙 평가
   */
  public static evaluateTickerExit(
    evaluation: FullTickerEvaluation,
    userPosition?: UserHoldPosition
  ): IntegratedExitEvaluation {
    const ticker = evaluation.ticker;
    const name = evaluation.name;
    const currentPrice = evaluation.price;
    const change1d = evaluation.change1d;

    const technical = evaluation.opportunity?.technical_details || {
      rsi14: 55,
      priceAboveMa20: true,
      ma20Above50: true,
      maTrend: 'NEUTRAL',
      drawdownFromHigh: -5,
    };

    const isHoldPosition = !!userPosition;
    const entryPrice = userPosition?.entryPrice;
    const shares = userPosition?.shares;
    const entryDate = userPosition?.entryDate;

    // 최고가 갱신 추적 (보유 종목의 경우)
    let highestPriceSinceEntry = userPosition?.highestPrice || currentPrice;
    if (currentPrice > highestPriceSinceEntry) {
      highestPriceSinceEntry = currentPrice;
    }

    // 진입가 대비 현재 수익률
    const returnSinceEntryPct = entryPrice
      ? Math.round(((currentPrice - entryPrice) / entryPrice) * 1000) / 10
      : undefined;

    // 고점 대비 현재 하락률
    const drawdownFromPeakPct = Math.round(
      ((currentPrice - highestPriceSinceEntry) / highestPriceSinceEntry) * 1000
    ) / 10;

    const signalsList: ExitSignalDetail[] = [];

    // ==========================================
    // Rule 1: 목표 수익률 도달 (Take Profit)
    // ==========================================
    const tp1Pct = userPosition?.targetTakeProfitPct ?? 15;
    const tp2Pct = tp1Pct + 10; // e.g. 25%
    const tp1Price = entryPrice ? Math.round(entryPrice * (1 + tp1Pct / 100) * 100) / 100 : 0;
    const tp2Price = entryPrice ? Math.round(entryPrice * (1 + tp2Pct / 100) * 100) / 100 : 0;

    let tpStatus: 'REACHED_TP2' | 'REACHED_TP1' | 'IN_PROGRESS' | 'NOT_APPLICABLE' =
      'NOT_APPLICABLE';
    let isTpTriggered = false;

    if (returnSinceEntryPct !== undefined) {
      if (returnSinceEntryPct >= tp2Pct) {
        tpStatus = 'REACHED_TP2';
        isTpTriggered = true;
        signalsList.push({
          type: 'TAKE_PROFIT_2',
          label: `🎯 2차 목표 익절 도달 (+${returnSinceEntryPct.toFixed(1)}%)`,
          urgency: 'HIGH',
          actionRecommendation: '잔여 물량 50%~전량 강력 익절 (수익 극대화 확정)',
          reason: `진입가($${entryPrice}) 대비 2차 목표 수익률(+${tp2Pct}%)을 돌파했습니다.`,
          triggerPrice: tp2Price,
          returnSinceEntryPct,
        });
      } else if (returnSinceEntryPct >= tp1Pct) {
        tpStatus = 'REACHED_TP1';
        isTpTriggered = true;
        signalsList.push({
          type: 'TAKE_PROFIT_1',
          label: `🎯 1차 목표 익절 도달 (+${returnSinceEntryPct.toFixed(1)}%)`,
          urgency: 'MEDIUM',
          actionRecommendation: '보유 수량의 30~50% 1차 분할 익절 권장',
          reason: `진입가($${entryPrice}) 대비 1차 목표 수익률(+${tp1Pct}%)에 도달했습니다.`,
          triggerPrice: tp1Price,
          returnSinceEntryPct,
        });
      } else {
        tpStatus = 'IN_PROGRESS';
      }
    }

    // ==========================================
    // Rule 2: 트레일링 스탑 (수익 보존 매도)
    // ==========================================
    // 진입가 대비 5% 이상 수익이 났던 적이 있고, 최고점 대비 -7% 이상 꺾일 때
    const trailingThresholdPct = userPosition?.trailingStopPct ?? -7;
    const trailingStopPrice = Math.round(
      highestPriceSinceEntry * (1 + trailingThresholdPct / 100) * 100
    ) / 100;
    let isTrailingTriggered = false;

    if (
      entryPrice &&
      highestPriceSinceEntry >= entryPrice * 1.05 && // 최소 5% 이상 상승한 적이 있음
      drawdownFromPeakPct <= trailingThresholdPct
    ) {
      isTrailingTriggered = true;
      signalsList.push({
        type: 'TRAILING_STOP',
        label: `🛡️ 트레일링 스탑 이탈 (${drawdownFromPeakPct.toFixed(1)}%)`,
        urgency: 'HIGH',
        actionRecommendation: '수익 보존을 위한 잔여 포지션 청산',
        reason: `진입 후 최고점($${highestPriceSinceEntry.toFixed(2)}) 대비 ${Math.abs(
          drawdownFromPeakPct
        )}% 하락하여 트레일링 스탑($${trailingStopPrice.toFixed(2)})을 하향 돌파했습니다.`,
        triggerPrice: trailingStopPrice,
        returnSinceEntryPct,
        drawdownFromPeakPct,
      });
    }

    // ==========================================
    // Rule 3: 최대 허용 손실 제한 (기계적 손절매 Stop Loss)
    // ==========================================
    const slThresholdPct = userPosition?.stopLossPct ?? -7;
    const stopLossPrice = entryPrice ? Math.round(entryPrice * (1 + slThresholdPct / 100) * 100) / 100 : 0;
    let isStopLossTriggered = false;

    if (returnSinceEntryPct !== undefined && returnSinceEntryPct <= slThresholdPct) {
      isStopLossTriggered = true;
      signalsList.push({
        type: 'STOP_LOSS',
        label: `🛑 기계적 손절매 신호 (${returnSinceEntryPct.toFixed(1)}%)`,
        urgency: 'CRITICAL',
        actionRecommendation: '추가 손실 방지를 위한 즉시 전량 손절매',
        reason: `진입가($${entryPrice}) 대비 최대 허용 손실 한도(${slThresholdPct}%)를 이탈했습니다.`,
        triggerPrice: stopLossPrice,
        returnSinceEntryPct,
      });
    }

    // ==========================================
    // Rule 4: 기술적 지표 추세 이탈 & 과열 (보유 여부 무관)
    // ==========================================
    const rsi14 = technical.rsi14 ?? 50;
    const isOverbought = rsi14 >= 74;
    const ma20Broken = technical.priceAboveMa20 === false;
    const ma50Broken = technical.ma20Above50 === false && technical.priceAboveMa20 === false;

    let isTechnicalTriggered = false;

    if (ma50Broken) {
      isTechnicalTriggered = true;
      signalsList.push({
        type: 'TREND_BREAK_50MA',
        label: `📉 중기 지지선(50 SMA) 붕괴 & 추세 전환`,
        urgency: 'HIGH',
        actionRecommendation: '추세 하락 전환 위험. 비중 축소 또는 매도',
        reason: `주가가 20일 및 50일 이동평균선 아래로 내려앉아 중기 상승 추세가 붕괴되었습니다.`,
      });
    } else if (ma20Broken && change1d < -1.5) {
      isTechnicalTriggered = true;
      signalsList.push({
        type: 'TREND_BREAK_20MA',
        label: `⚠️ 단기 생명선(20 SMA) 하향 이탈`,
        urgency: 'MEDIUM',
        actionRecommendation: '단기 지지선 이탈에 따른 리스크 관리 (차익실현 or 분할매도)',
        reason: `20일 이동평균선 지지에 실패하며 단기 조정 국면으로 진입했습니다.`,
      });
    } else if (isOverbought) {
      isTechnicalTriggered = true;
      signalsList.push({
        type: 'OVERBOUGHT_DIVERGENCE',
        label: `🔥 극단적 기술적 과열 (RSI ${rsi14.toFixed(1)})`,
        urgency: 'LOW',
        actionRecommendation: '추격 매수 금지 및 단기 고점 차익실현 분할매도 검토',
        reason: `RSI가 ${rsi14.toFixed(1)}에 달해 단기 과매수 영역입니다. 조정 가능성이 높습니다.`,
      });
    }

    // ==========================================
    // 종합 매도 판정 및 우선순위 결정
    // ==========================================
    let primaryExitSignal: SellSignalType = 'HOLD';
    let urgency: SellUrgency = 'NONE';
    let headline = '정상 보유 (안정적 추세 유지)';
    let recommendedAction = '현재 매도 신호 없음. 기존 포지션 유지';

    if (isStopLossTriggered) {
      primaryExitSignal = 'STOP_LOSS';
      urgency = 'CRITICAL';
      headline = `🛑 기계적 손절매 (자본 보호 최우선)`;
      recommendedAction = `손실 확대를 차단하기 위해 전량 손절매를 권고합니다.`;
    } else if (isTrailingTriggered) {
      primaryExitSignal = 'TRAILING_STOP';
      urgency = 'HIGH';
      headline = `🛡️ 트레일링 스탑 발동 (수익 확정 매도)`;
      recommendedAction = `최고점 대비 하락으로 수익 보존을 위해 잔여 포지션을 매도 청산하세요.`;
    } else if (isTpTriggered && tpStatus === 'REACHED_TP2') {
      primaryExitSignal = 'TAKE_PROFIT_2';
      urgency = 'HIGH';
      headline = `🎯 2차 목표가 도달 (+${returnSinceEntryPct?.toFixed(1)}% 달성)`;
      recommendedAction = `목표 초과 달성에 따라 잔여 물량의 50% 이상 강력 익절을 권고합니다.`;
    } else if (isTpTriggered && tpStatus === 'REACHED_TP1') {
      primaryExitSignal = 'TAKE_PROFIT_1';
      urgency = 'MEDIUM';
      headline = `🎯 1차 목표가 도달 (+${returnSinceEntryPct?.toFixed(1)}% 수익)`;
      recommendedAction = `원금 회수 및 리스크 축소를 위해 30~50% 1차 분할 익절하세요.`;
    } else if (ma50Broken) {
      primaryExitSignal = 'TREND_BREAK_50MA';
      urgency = 'HIGH';
      headline = `📉 중기 지지선 붕괴 (추세 이탈 경보)`;
      recommendedAction = `주요 이동평균선이 붕괴되었습니다. 비중을 축소하고 관망하세요.`;
    } else if (ma20Broken && change1d < -1.5) {
      primaryExitSignal = 'TREND_BREAK_20MA';
      urgency = 'MEDIUM';
      headline = `⚠️ 단기 20일선 이탈 경고`;
      recommendedAction = `단기 지지선이 무너졌습니다. 일부 물량 분할 차익실현을 검토하세요.`;
    } else if (isOverbought) {
      primaryExitSignal = 'OVERBOUGHT_DIVERGENCE';
      urgency = 'LOW';
      headline = `🔥 극단적 과열 (RSI ${rsi14.toFixed(1)})`;
      recommendedAction = `단기 과매수 상태입니다. 분할 차익실현을 고려하세요.`;
    }

    const isActionableSell = primaryExitSignal !== 'HOLD';

    return {
      ticker,
      name,
      currentPrice,
      change1d,
      isHoldPosition,
      entryPrice,
      shares,
      entryDate,
      highestPriceSinceEntry,
      returnSinceEntryPct,
      primaryExitSignal,
      urgency,
      isActionableSell,
      headline,
      recommendedAction,
      rules: {
        takeProfit: {
          triggered: isTpTriggered,
          targetPct: tp1Pct,
          targetPrice: tp1Price,
          label:
            tpStatus === 'REACHED_TP2'
              ? `2차 목표 돌파 (+${returnSinceEntryPct?.toFixed(1)}%)`
              : tpStatus === 'REACHED_TP1'
              ? `1차 목표 도달 (+${returnSinceEntryPct?.toFixed(1)}%)`
              : returnSinceEntryPct !== undefined
              ? `진행 중 (${returnSinceEntryPct >= 0 ? '+' : ''}${returnSinceEntryPct.toFixed(1)}% / 목표 +${tp1Pct}%)`
              : `목표가 $${tp1Price} (+${tp1Pct}%)`,
          status: tpStatus,
        },
        trailingStop: {
          triggered: isTrailingTriggered,
          highestPrice: highestPriceSinceEntry,
          stopPrice: trailingStopPrice,
          drawdownFromPeakPct,
          label: isTrailingTriggered
            ? `스탑 이탈 (${drawdownFromPeakPct.toFixed(1)}% / 기준 ${trailingThresholdPct}%)`
            : `고점 대비 ${drawdownFromPeakPct.toFixed(1)}% (스탑 기준 ${trailingThresholdPct}%)`,
        },
        stopLoss: {
          triggered: isStopLossTriggered,
          stopPrice: stopLossPrice,
          lossPct: returnSinceEntryPct ?? 0,
          label: isStopLossTriggered
            ? `손절선 이탈 (${returnSinceEntryPct?.toFixed(1)}% / 기준 ${slThresholdPct}%)`
            : entryPrice
            ? `손절가 $${stopLossPrice} (${slThresholdPct}%)`
            : `기준 ${slThresholdPct}%`,
        },
        technicalExit: {
          triggered: isTechnicalTriggered,
          rsi14,
          isOverbought,
          ma20Broken,
          ma50Broken,
          label: ma50Broken
            ? '50일선 붕괴 (위험)'
            : ma20Broken
            ? '20일선 이탈'
            : isOverbought
            ? `RSI 과열 (${rsi14.toFixed(1)})`
            : '추세 양호',
        },
      },
      signalsList,
    };
  }

  /**
   * 전체 유니버스 + 사용자 보유 종목 통합 매도 평가 산출
   */
  public static evaluateAllExits(
    evaluations: FullTickerEvaluation[],
    userPositions?: UserHoldPosition[]
  ): IntegratedExitEvaluation[] {
    const positions = userPositions || this.getUserPositions();
    const positionMap = new Map<string, UserHoldPosition>();
    for (const pos of positions) {
      positionMap.set(pos.ticker.toUpperCase(), pos);
    }

    const results: IntegratedExitEvaluation[] = [];

    // 1. 모니터링 중인 전체 종목 평가 (보유 종목 매칭 포함)
    for (const ev of evaluations || []) {
      const pos = positionMap.get(ev.ticker.toUpperCase());
      const exitEval = this.evaluateTickerExit(ev, pos);
      results.push(exitEval);
      positionMap.delete(ev.ticker.toUpperCase());
    }

    // 2. 워치리스트에는 없지만 사용자가 보유 중으로 등록한 종목이 있다면 추가
    for (const [ticker, pos] of positionMap.entries()) {
      const syntheticEv: FullTickerEvaluation = {
        ticker,
        name: pos.name || ticker,
        price: pos.highestPrice || pos.entryPrice,
        change1d: 0,
        evaluated_at: new Date().toISOString(),
        classification: {
          ticker,
          asset_type: 'equity',
          strategy_type: 'quality',
          confidence: 1.0,
          classification_source: 'auto',
          reason: 'User registered holding position',
          classified_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        opportunity: {
          opportunity_score: 50,
          sub_scores: { technical_score: 50, momentum_score: 50, fundamental_score: 50, valuation_score: 50 },
          weights_used: { technical: 0.3, momentum: 0.3, fundamental: 0.2, valuation: 0.2 },
          technical_details: {
            maTrend: 'NEUTRAL',
            rsi14: 50,
            rsiScore: 50,
            drawdownFromHigh: 0,
            drawdownScore: 50,
            ma20Above50: true,
            ma50Above200: true,
            priceAboveMa20: true,
            macdHistogramPositive: true,
          },
          momentum_details: {
            return1M: 0,
            return3M: 0,
            return6M: 0,
            relativeStrengthVsSpy: 0,
            momentumScore: 50,
            trendPersistence: 50,
          },
          fundamental_details: {
            revenueGrowthYoy: null,
            earningsGrowthYoy: null,
            operatingMargin: null,
            freeCashFlowMargin: null,
            marketCapBillions: null,
            isEtf: false,
          },
          valuation_details: {
            peTrailing: null,
            peForward: null,
            psRatio: null,
            evToEbitda: null,
            pegRatio: null,
            isEtf: false,
          },
        },
        risk: {
          risk_score: 30,
          risk_level: 'LOW',
          components: {
            beta: 1.0,
            volatility20dAnnualized: 0.25,
            maxDrawdown52w: -10,
            isSpeculative: false,
            technicalInstabilityScore: 30,
            dataUncertaintyScore: 0,
          },
          risk_reasons: [],
        },
        decision: {
          decision: 'NEUTRAL',
          opportunity_score: 50,
          confidence: 0.8,
          reason: 'User holding',
          actionable: false,
          threshold_met: false,
        },
        signal_generated: false,
      };

      results.push(this.evaluateTickerExit(syntheticEv, pos));
    }

    // 정렬: 보유 종목 우선, 그 다음 긴급도 높은 순
    const urgencyOrder: Record<SellUrgency, number> = {
      CRITICAL: 5,
      HIGH: 4,
      MEDIUM: 3,
      LOW: 2,
      NONE: 1,
    };

    return results.sort((a, b) => {
      // 1. 보유 종목이면서 매도 신호가 뜬 종목 최상단
      if (a.isHoldPosition && a.isActionableSell && !(b.isHoldPosition && b.isActionableSell)) return -1;
      if (!(a.isHoldPosition && a.isActionableSell) && b.isHoldPosition && b.isActionableSell) return 1;

      // 2. 긴급도 높은 순
      const diffUrgency = urgencyOrder[b.urgency] - urgencyOrder[a.urgency];
      if (diffUrgency !== 0) return diffUrgency;

      // 3. 보유 종목 여부
      if (a.isHoldPosition && !b.isHoldPosition) return -1;
      if (!a.isHoldPosition && b.isHoldPosition) return 1;

      return a.ticker.localeCompare(b.ticker);
    });
  }
}
