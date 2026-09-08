/**
 * Global operational and infrastructure limits for the Quant Decision Engine.
 * 
 * Cloudflare Workers free plan subrequest quota is 50.
 * A 30-item capacity leaves plenty of margin (~15 subrequests) for Supabase DB
 * sync, Telegram webhook alert delivery, and network retries without 500 timeouts.
 */
export const MAX_WATCHLIST_CAPACITY = 30;

export const WATCHLIST_CAPACITY_ERROR_MESSAGE = `워치리스트 등록 한도(최대 ${MAX_WATCHLIST_CAPACITY}개)에 도달했습니다. 클라우드플레어 런타임 및 실시간 스캔 안정성을 위해 기존 종목을 삭제한 후 추가해 주세요.`;
