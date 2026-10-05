import { describe, it, expect } from 'vitest';
import { resolveSingleQuery, searchStockMaster } from './stockSearchService';

describe('stockSearchService Korean ETF resolution', () => {
  it('6자리 숫자 코드로 한국 ETF 조회 시 실제 공식 종목명으로 반환한다', () => {
    // 122630 -> KODEX 레버리지
    const resLev = resolveSingleQuery('122630');
    expect(resLev.resolved).toBe(true);
    expect(resLev.ticker).toBe('122630.KS');
    expect(resLev.name).toBe('KODEX 레버리지');
    expect(resLev.name).not.toContain('국내종목');

    // 252670 -> KODEX 200선물인버스2X
    const resInv2x = resolveSingleQuery('252670.KS');
    expect(resInv2x.resolved).toBe(true);
    expect(resInv2x.ticker).toBe('252670.KS');
    expect(resInv2x.name).toBe('KODEX 200선물인버스2X');
    expect(resInv2x.name).not.toContain('국내종목');
  });

  it('별칭 및 약칭(곱버스, 레버리지 등)으로 한국 ETF를 정확히 해석한다', () => {
    const resGop = resolveSingleQuery('곱버스');
    expect(resGop.resolved).toBe(true);
    expect(resGop.ticker).toBe('252670.KS');
    expect(resGop.name).toBe('KODEX 200선물인버스2X');

    const resLev = resolveSingleQuery('레버리지');
    expect(resLev.resolved).toBe(true);
    expect(resLev.ticker).toBe('122630.KS');
    expect(resLev.name).toBe('KODEX 레버리지');
  });

  it('searchStockMaster 검색 시 실제 ETF 종목명이 자동완성에 정상 노출된다', () => {
    // 6자리 코드로 검색 시 '국내종목'이 아닌 실제 종목명 제공
    const searchCode = searchStockMaster('122630', 5);
    expect(searchCode.length).toBeGreaterThan(0);
    expect(searchCode[0].ticker).toBe('122630.KS');
    expect(searchCode[0].name).toBe('KODEX 레버리지');
    expect(searchCode[0].name).not.toContain('국내종목');

    // 키워드로 검색 시
    const searchLev = searchStockMaster('레버리지', 5);
    expect(searchLev.some((s) => s.ticker === '122630.KS' && s.name === 'KODEX 레버리지')).toBe(true);

    const searchDow = searchStockMaster('미국배당다우존스', 5);
    expect(searchDow.some((s) => s.ticker === '458730.KS' && s.name.includes('TIGER 미국배당다우존스'))).toBe(true);
  });
});
