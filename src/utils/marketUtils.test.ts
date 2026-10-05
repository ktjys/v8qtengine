import { describe, it, expect } from 'vitest';
import {
  formatStockDisplayName,
  formatTelegramStockName,
  getStockDisplayInfo,
  detectMarketRegion,
} from './marketUtils';
import {
  buildDipBuyTelegramMessage,
  buildSignalTelegramMessage,
  buildExitSignalTelegramMessage,
} from '../notification/templates';

describe('marketUtils & Notification Stock Name Formatting', () => {
  describe('formatStockDisplayName & formatTelegramStockName', () => {
    it('국내 종목 코드가 들어왔을 때 종목명을 우선 표기하고 코드를 괄호로 보조 표기한다', () => {
      // 005930.KS -> 삼성전자 (005930)
      const formatted = formatStockDisplayName('005930.KS');
      expect(formatted).toBe('삼성전자 (005930)');

      const tgFormatted = formatTelegramStockName('005930.KS');
      expect(tgFormatted).toBe('<b>삼성전자</b> (005930)');

      // 000660.KS -> SK하이닉스 (000660)
      expect(formatStockDisplayName('000660.KS')).toBe('SK하이닉스 (000660)');
      expect(formatTelegramStockName('000660.KS')).toBe('<b>SK하이닉스</b> (000660)');
    });

    it('국내 ETF 코드가 들어왔을 때 국내종목 대신 실제 ETF 공식 종목명으로 표시된다', () => {
      // 122630 -> KODEX 레버리지
      const lev = formatStockDisplayName('122630.KS');
      expect(lev).toBe('KODEX 레버리지 (122630)');
      expect(formatTelegramStockName('122630.KS')).toBe('<b>KODEX 레버리지</b> (122630)');

      // 252670 -> KODEX 200선물인버스2X (곱버스)
      const inv2x = formatStockDisplayName('252670.KS');
      expect(inv2x).toBe('KODEX 200선물인버스2X (252670)');

      // 114800 -> KODEX 인버스
      expect(formatStockDisplayName('114800.KS')).toBe('KODEX 인버스 (114800)');

      // 458730 -> TIGER 미국배당다우존스
      expect(formatStockDisplayName('458730.KS')).toBe('TIGER 미국배당다우존스 (458730)');

      // 102110 -> TIGER 200
      expect(formatStockDisplayName('102110.KS')).toBe('TIGER 200 (102110)');
    });

    it('기존에 "국내종목" 또는 "국내종목 122630" 같은 플레이스홀더가 들어와도 실제 ETF 종목명으로 정제한다', () => {
      const displayInfo = getStockDisplayInfo('122630.KS', '국내종목 122630');
      expect(displayInfo.primaryName).toBe('KODEX 레버리지');
      expect(displayInfo.primaryName).not.toContain('국내종목');

      const legacyPlaceholder = formatStockDisplayName('252670.KS', '국내종목');
      expect(legacyPlaceholder).toBe('KODEX 200선물인버스2X (252670)');
      expect(legacyPlaceholder).not.toContain('국내종목');

      // 사전에 없는 종목에 '국내종목'이 들어온 경우에도 '국내종목' 대신 종목코드 반환
      const unknownWithLegacy = formatStockDisplayName('999999.KS', '국내종목 999999');
      expect(unknownWithLegacy).toBe('999999');
      expect(unknownWithLegacy).not.toContain('국내종목');
    });

    it('미국 종목 코드가 들어왔을 때 친화적 이름과 티커를 올바르게 조합한다', () => {
      const nvdaFormatted = formatTelegramStockName('NVDA');
      expect(nvdaFormatted).toContain('엔비디아');
      expect(nvdaFormatted).toContain('NVDA');
      expect(nvdaFormatted.startsWith('<b>')).toBe(true);

      const tslaFormatted = formatTelegramStockName('TSLA');
      expect(tslaFormatted).toContain('테슬라');
      expect(tslaFormatted).toContain('TSLA');
    });

    it('사전에 없는 신규 종목이라도 rawName이 주어지면 종목명 우선으로 포맷팅한다', () => {
      const res = formatTelegramStockName('999999.KS', '신규상장기업');
      expect(res).toBe('<b>신규상장기업</b> (999999)');
    });
  });

  describe('Notification Templates (templates.ts)', () => {
    it('전략 B 눌림목 알림(buildDipBuyTelegramMessage)에서 종목명이 종목코드 앞에 강조 표시된다', () => {
      const msg = buildDipBuyTelegramMessage({
        ticker: '005930.KS',
        name: '삼성전자',
        price: 72000,
        change1d: -1.5,
        suitability: {
          tier: 'S',
          tierLabel: '초대형 우량주',
          score: 95,
          isSuitable: true,
          breakdown: {
            indexStatusScore: 30,
            marketCapScore: 25,
            qualityScore: 20,
            stabilityScore: 20,
          },
          reasons: [],
        },
        timing: {
          score: 85,
          rsi: 28.5,
          rsiZone: 'DIP_ZONE',
          drawdownFromHigh: -0.12,
          drawdownLabel: '-12.0%',
          supportLevel: '지표 지지선',
          reasons: [],
        },
        dip_score: 90,
        actionSignal: 'STRONG_DIP_BUY',
        signalLabel: '적극 분할매수',
        actionable: true,
        guidanceMessage: '분할 매수 적합',
        suggestedDcaRatio: '1.5x (정기적립 대비 150%)',
      });

      expect(msg).toContain('📌 <b>삼성전자</b> (005930)');
      expect(msg).toContain('₩72,000');
    });

    it('매도/청산 신호 알림(buildExitSignalTelegramMessage)에서 종목명이 종목코드 앞에 강조 표시된다', () => {
      const msg = buildExitSignalTelegramMessage([
        {
          ticker: '000660.KS',
          name: 'SK하이닉스',
          headline: '1차 목표가 도달',
          action: '절반 익절',
          currentPrice: 195000,
          returnPct: 18.5,
        },
      ]);

      expect(msg).toContain('📌 <b>SK하이닉스</b> (000660)');
      expect(msg).toContain('₩195,000');
      expect(msg).toContain('+18.5%');
    });
  });
});
