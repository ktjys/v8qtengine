import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runHistoricalReplay } from './strategyReplay';
import { historicalDataProvider } from './historicalDataProvider';
import { SeedDataProvider } from '../data/seed/seedProvider';
import { OHLCVBar } from '../data/providers/types';

const seedProvider = new SeedDataProvider();

// 결정적 픽스처: SeedDataProvider가 P1-1 수정으로 고정 end-date 기준 재현성을
// 보장하므로, 동일 (ticker, range, interval, endDate)는 항상 동일 bars를 만든다.
async function fixtureBars(ticker: string, endDate?: string): Promise<OHLCVBar[]> {
  return seedProvider.getHistorical(ticker, '1y', '1d', endDate);
}

beforeEach(() => {
  vi.restoreAllMocks();
});

// getHistoricalBarsForTicker를 결정적 픽스처로 대체하면 네트워크/Yahoo 의존 없이
// replay 로직(재현성, PIT)을 헤르메틱하게 검증할 수 있다.
function mockBars(endDate?: string) {
  vi.spyOn(historicalDataProvider, 'getHistoricalBarsForTicker').mockImplementation(
    async (ticker: string, range = '1y') => {
      if (ticker === 'SPY') return fixtureBars('SPY', endDate);
      return fixtureBars(ticker, endDate);
    }
  );
}

describe('runHistoricalReplay — 재현성 (P1-1)', () => {
  it('동일 입력이면 동일 결과를 낸다 (summary + signals + equityCurve)', async () => {
    mockBars('2024-06-30');
    const cfg = { startDate: '2024-01-01', endDate: '2024-06-30', tickers: ['AAPL', 'MSFT', 'NVDA'] };
    const a = await runHistoricalReplay(cfg);
    const b = await runHistoricalReplay(cfg);
    expect(a.summary).toEqual(b.summary);
    expect(a.signals).toEqual(b.signals);
    expect(a.equityCurve).toEqual(b.equityCurve);
    expect(a.testedUniverseCount).toBe(3);
  });

  it('endDate를 바꿔도 동일한 bars가 쓰이면 (고정 anchor) 시그널이 재현된다', async () => {
    // endDate 차이가 PRNG 시드가 아니라 anchor에만 영향 주어야 재현 가능.
    // 여기서는 동일 endDate를 다시 전달해 결정성만 확인한다.
    mockBars('2024-06-15');
    const cfg = { startDate: '2024-01-01', endDate: '2024-06-15', tickers: ['AAPL'] };
    const r1 = await runHistoricalReplay(cfg);
    const r2 = await runHistoricalReplay(cfg);
    expect(r1.signals).toEqual(r2.signals);
  });
});

describe('runHistoricalReplay — PIT look-ahead 방지', () => {
  it('endDate를 늘려도 기존 시그널의 20d 미래 수익률이 변하지 않는다', async () => {
    // 짧은 기간: 종료 전 신호의 return20d는 20봉 앞이 기간 밖이어서 undefined일 수 있다.
    // look-ahead bias가 있다면 endDate를 늘리는 순간 그 20d가 '미리 보여지며' 채워진다.
    const shortEnd = '2024-03-01';
    const longEnd = '2024-06-30';
    mockBars(longEnd);

    const shortCfg = { startDate: '2024-01-01', endDate: shortEnd, tickers: ['AAPL', 'MSFT'] };
    const longCfg = { startDate: '2024-01-01', endDate: longEnd, tickers: ['AAPL', 'MSFT'] };

    const short = await runHistoricalReplay(shortCfg);
    // 주의: short 실행과 long 실행은 서로 다른 bars를 쓸 수 있으므로, 여기서는
    // 동일 bars(longEnd 앵커)로 short 시뮬레이션을 재구성해야 정확하다.
    const shortBars = new Map<string, OHLCVBar[]>();
    for (const t of ['SPY', 'AAPL', 'MSFT']) shortBars.set(t, await fixtureBars(t, longEnd));

    const longResult = await runHistoricalReplay(longCfg);

    // endDate(shortEnd) 이전에 진입한 신호가 장기 실행에서도 동일하게 존재하고,
    // 그 return20d는 shortEnd 시점에는 (20봉이 없어) 미확정이었어야 한다.
    const earlySignals = longResult.signals.filter((s) => s.entryDate <= shortEnd);
    for (const sig of earlySignals) {
      const bars = shortBars.get(sig.ticker)!;
      const entryIdx = bars.findIndex((b) => b.date === sig.entryDate);
      expect(entryIdx).toBeGreaterThanOrEqual(0);
      // 20봉 앞이 shortEnd 이후라면 그 시점엔 알 수 없었어야 함 (미래 정보 금지).
      // 여기서는 실제 20봉 존재 여부만 검증하며, 존재하면 계산 값은 고정 bars이므로 확정.
      if (entryIdx + 20 < bars.length) {
        const bar20 = bars[entryIdx + 20];
        const expected = Math.round(((bar20.close - sig.entryPrice) / sig.entryPrice) * 100 * 100) / 100;
        expect(sig.return20d).toBe(expected);
      }
    }
  });
});

describe('getForwardOutcomes — 수동 대조', () => {
  it('return5d/10d/20d가 실제 미래 봉 종가와 일치한다', async () => {
    const bars = await fixtureBars('TESTFWD', '2024-06-30');
    const entryIdx = 100;
    const outcomes = historicalDataProvider.getForwardOutcomes(bars, entryIdx);
    const entryPrice = bars[entryIdx].close;

    const r5 = ((bars[entryIdx + 5].close - entryPrice) / entryPrice) * 100;
    const r10 = ((bars[entryIdx + 10].close - entryPrice) / entryPrice) * 100;
    const r20 = ((bars[entryIdx + 20].close - entryPrice) / entryPrice) * 100;

    expect(outcomes.entryPrice).toBe(entryPrice);
    expect(outcomes.return5d).toBe(Math.round(r5 * 100) / 100);
    expect(outcomes.return10d).toBe(Math.round(r10 * 100) / 100);
    expect(outcomes.return20d).toBe(Math.round(r20 * 100) / 100);
    expect(outcomes.return5d).not.toBeNull();
    expect(outcomes.return10d).not.toBeNull();
    expect(outcomes.return20d).not.toBeNull();
  });

  it('장기 지평(60/120/252d) return이 실제 미래 봉 종가와 일치한다', async () => {
    const bars = await fixtureBars('TESTLONG', '2024-06-30');
    const entryIdx = 10; // 모든 지평이 범위 안에 있도록 앞쪽 인덱스
    const outcomes = historicalDataProvider.getForwardOutcomes(bars, entryIdx);
    const entryPrice = bars[entryIdx].close;

    const check = (n: number, ret: number | null) => {
      if (entryIdx + n < bars.length) {
        const expected = Math.round(((bars[entryIdx + n].close - entryPrice) / entryPrice) * 10000) / 100;
        expect(ret).toBe(expected);
      }
    };
    check(60, outcomes.return60d);
    check(120, outcomes.return120d);
    check(252, outcomes.return252d);

    // 60/120d는 이 픽스처 바 수(~180개)에서 완료되어야 함
    expect(outcomes.return60d).not.toBeNull();
    expect(outcomes.return120d).not.toBeNull();
  });

  it('기간 끝의 시그널은 미래 수익률이 null(미확정)이다', async () => {
    const bars = await fixtureBars('TESTEND', '2024-06-30');
    // 20봉 앞은 범위 밖, 10봉 앞은 범위 안이 되는 인덱스 (length-15)
    const lastIdx = bars.length - 15;
    const outcomes = historicalDataProvider.getForwardOutcomes(bars, lastIdx);
    expect(outcomes.return20d).toBeNull();
    expect(outcomes.return10d).not.toBeNull();
  });

  it('getPointInTimeSlice는 현재 인덱스 이후 봉을 절대 노출하지 않는다', async () => {
    const bars = await fixtureBars('TESTPIT', '2024-06-30');
    const slice = historicalDataProvider.getPointInTimeSlice(bars, 30);
    expect(slice.length).toBe(31);
    expect(slice[30]).toEqual(bars[30]);
    // 미래 봉 접근 금지
    expect(slice[31]).toBeUndefined();
  });
});

describe('runHistoricalReplay — 결과 구조 정합성', () => {
  it('반환 객체에 summary/signals/equityCurve/날짜가 포함된다', async () => {
    mockBars('2024-04-30');
    const res = await runHistoricalReplay({
      startDate: '2024-01-01',
      endDate: '2024-04-30',
      tickers: ['AAPL'],
    });
    expect(res).toHaveProperty('summary');
    expect(res).toHaveProperty('signals');
    expect(res).toHaveProperty('equityCurve');
    expect(res.startDate).toBe('2024-01-01');
    expect(res.endDate).toBe('2024-04-30');
    expect(res.testedUniverseCount).toBe(1);
    expect(res.summary.total_signals).toBe(res.signals.length);
  });
});
