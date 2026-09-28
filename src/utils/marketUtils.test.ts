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
