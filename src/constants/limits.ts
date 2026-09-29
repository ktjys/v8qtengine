/**
 * Global operational and infrastructure limits for the Quant Decision Engine.
 * 
 * Cloudflare Workers free plan subrequest quota is 50.
 * A 30-item capacity per market (US/KR) leaves plenty of margin (~15 subrequests) for Supabase DB
 * sync, Telegram webhook alert delivery, and network retries without 500 timeouts.
 */
export const MAX_WATCHLIST_CAPACITY_PER_MARKET = 30;

export function getWatchlistCapacityErrorMessage(market: 'US' | 'KR'): string {
  const marketLabel = market === 'US' ? '미국장' : '국내장';
  return `${marketLabel} 워치리스트 등록 한도(최대 ${MAX_WATCHLIST_CAPACITY_PER_MARKET}개)에 도달했습니다. 기존 종목을 삭제한 후 추가해 주세요.`;
}
