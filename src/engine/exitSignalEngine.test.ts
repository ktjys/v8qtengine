import { describe, it, expect } from 'vitest';
import { ExitSignalEngine } from './exitSignalEngine';
import { FullTickerEvaluation } from '../types/v8';

describe('ExitSignalEngine — 시장 격리 (Market Isolation)', () => {
  const krEvaluation = {
    ticker: '005930.KS',
    name: '삼성전자',
    price: 75000,
    change1d: 1.2,
    evaluated_at: new Date().toISOString(),
    classification: {
      ticker: '005930.KS',
      asset_type: 'equity',
      strategy_type: 'established_growth',
      confidence: 1.0,
      classification_source: 'auto',
      reason: 'Semiconductor giant',
      classified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    opportunity: {
      opportunity_score: 75,
      technical_details: {
        rsi14: 62,
        priceAboveMa20: true,
        ma20Above50: true,
      },
    },
    risk: {
      risk_score: 20,
      risk_level: 'LOW',
    },
    decision: {
      decision: 'OPPORTUNITY',
      actionable: true,
      reason: '양호한 펀더멘털 및 모멘텀 지속',
    },
    signal_generated: true,
  } as unknown as FullTickerEvaluation;

  const usEvaluation = {
    ...krEvaluation,
    ticker: 'NVDA',
    name: 'NVIDIA Corp',
    price: 135.0,
    change1d: 2.5,
  } as unknown as FullTickerEvaluation;

  it('국내장(KR) 평가 시 미국 보유 종목(NVDA, TSLA, SPY)이 청산 신호로 누출되지 않는다', () => {
    const krResults = ExitSignalEngine.evaluateAllExits([krEvaluation], undefined, 'KR');
    expect(krResults.length).toBeGreaterThan(0);
    for (const r of krResults) {
      expect(r.ticker.endsWith('.KS') || r.ticker.endsWith('.KQ')).toBe(true);
      expect(r.ticker).not.toBe('NVDA');
      expect(r.ticker).not.toBe('TSLA');
      expect(r.ticker).not.toBe('SPY');
    }
  });

  it('미국장(US) 평가 시 국내 보유 종목(005930.KS, 000660.KS)이 누출되지 않는다', () => {
    const usResults = ExitSignalEngine.evaluateAllExits([usEvaluation], undefined, 'US');
    expect(usResults.length).toBeGreaterThan(0);
    for (const r of usResults) {
      expect(r.ticker.endsWith('.KS') || r.ticker.endsWith('.KQ')).toBe(false);
      expect(r.ticker).not.toContain('.KS');
      expect(r.ticker).not.toContain('.KQ');
    }
  });

  it('marketRegion 인자가 생략되어도 입력 evaluation의 마켓이 단일하면 자동 감지하여 격리한다', () => {
    const inferredKrResults = ExitSignalEngine.evaluateAllExits([krEvaluation]);
    for (const r of inferredKrResults) {
      expect(r.ticker).not.toBe('NVDA');
      expect(r.ticker).not.toBe('TSLA');
      expect(r.ticker).not.toBe('SPY');
    }
  });

  it('사용자 등록 평단가가 있는 경우 명확한 출처 라벨과 계산된 수익률을 제공한다', () => {
    const result = ExitSignalEngine.evaluateTickerExit(krEvaluation, {
      id: 'test_1',
      ticker: '005930.KS',
      name: '삼성전자',
      entryPrice: 70000,
      shares: 10,
      entryDate: '2024-10-01',
      created_at: '2024-10-01',
      source: 'MANUAL',
    });

    expect(result.isHoldPosition).toBe(true);
    expect(result.entryPrice).toBe(70000);
    expect(result.returnSinceEntryPct).toBeCloseTo(7.1, 1);
    expect(result.entryPriceBasisLabel).toContain('실계좌 등록 평단가');
    expect(result.entryPriceBasisLabel).toContain('2024-10-01');
  });

  it('평단가가 미등록된 관심종목은 애매한 ₩0 표기 대신 평단가 미등록 라벨과 기술적 지표 감시 모드로 작동한다', () => {
    const result = ExitSignalEngine.evaluateTickerExit(krEvaluation, undefined);

    expect(result.isHoldPosition).toBe(false);
    expect(result.entryPrice).toBeUndefined();
    expect(result.returnSinceEntryPct).toBeUndefined();
    expect(result.entryPriceBasisLabel).toBe('평단가 미등록 (기술적 추세 이탈만 감시)');
    expect(result.rules.takeProfit.label).toContain('평단가 미등록');
    expect(result.rules.stopLoss.label).toContain('평단가 미등록');
    expect(result.rules.trailingStop.label).toContain('평단가 미등록');
  });

  it('평단가가 미등록되어도 50일 이동평균선이 붕괴되면 기술적 매도 경보를 발행한다', () => {
    const brokenEvaluation = {
      ...krEvaluation,
      opportunity: {
        ...krEvaluation.opportunity,
        technical_details: {
          rsi14: 45,
          priceAboveMa20: false,
          ma20Above50: false,
        },
      },
    } as unknown as FullTickerEvaluation;

    const result = ExitSignalEngine.evaluateTickerExit(brokenEvaluation, undefined);
    expect(result.primaryExitSignal).toBe('TREND_BREAK_50MA');
    expect(result.isActionableSell).toBe(true);
    expect(result.recommendedAction).toContain('50일선이 붕괴');
  });
});
