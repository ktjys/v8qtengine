export interface ScanQueue {
  sendBatch(messages: { body: string }[]): Promise<void>;
}

export interface Env {
  SCAN_QUEUE?: ScanQueue;
  SUPABASE_URL?: string;
  SUPABASE_KEY?: string;
  SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  VITE_SUPABASE_URL?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  API_AUTH_TOKEN?: string;
  CRON_SECRET_TOKEN?: string;
  REQUIRE_API_AUTH?: string;
  V8_DATA_PROVIDER?: string;
  NODE_VERSION?: string;
}

export type ScanMarket = 'US' | 'KR';

export type ChunkStatus = 'SUCCESS' | 'PARTIAL_SUCCESS' | 'FAILED';

export interface ScanChunkMessage {
  scanRunId: string;
  market: ScanMarket;
  tickers: string[];
  chunkIndex: number;
  totalChunks: number;
  slot: string;
  triggeredBy: string;
  sourceUrl?: string;
}

export interface ScanChunkResult {
  success: boolean;
  evaluatedCount: number;
  signalCount: number;
  failureCount: number;
  chunkStatus: ChunkStatus;
  finalized: boolean;
}

export interface ScanStartResult {
  scanId: string;
  status: 'RUNNING' | 'FAILED' | 'SKIPPED_CLOSED_MARKET' | 'SKIPPED_EMPTY_WATCHLIST' | 'QUEUE_MISSING';
}
