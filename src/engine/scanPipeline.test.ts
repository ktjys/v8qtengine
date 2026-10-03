import { describe, it, expect } from 'vitest';
import {
  parseChunkMessage,
  estimateBudget,
  getOptimalChunkSize,
  getChunkSizeLimit,
} from './scanChunkProcessor';
import type { ScanChunkMessage } from './types';

function makeMessage(overrides: Partial<ScanChunkMessage> = {}): ScanChunkMessage {
  return {
    scanRunId: '3f1c9a20-1111-4222-8333-444455556666',
    market: 'US',
    tickers: ['AAPL', 'MSFT'],
    chunkIndex: 0,
    totalChunks: 3,
    slot: '🌅 [미국장 마감] 브리핑 (06:30 KST)',
    triggeredBy: 'CloudflareCron:30 21 * * 1-5',
    ...overrides,
  };
}

describe('parseChunkMessage', () => {
  it('parses the JSON string body that Cloudflare Queues delivers', () => {
    const message = makeMessage();
    const parsed = parseChunkMessage(JSON.stringify(message));

    expect(parsed).not.toBeNull();
    expect(parsed?.scanRunId).toBe(message.scanRunId);
    expect(parsed?.tickers).toEqual(['AAPL', 'MSFT']);
    expect(parsed?.market).toBe('US');
    expect(parsed?.chunkIndex).toBe(0);
    expect(parsed?.totalChunks).toBe(3);
  });

  it('round-trips a message produced by the orchestrator envelope', () => {
    const message = makeMessage({ market: 'KR', tickers: ['005930.KS'] });
    const body = JSON.stringify(message);

    expect(parseChunkMessage(body)).toEqual(message);
  });

  it('accepts an already-parsed object body', () => {
    const message = makeMessage();
    expect(parseChunkMessage(message)).toEqual(message);
  });

  it('rejects a double-encoded body instead of silently losing every field', () => {
    const body = JSON.stringify(JSON.stringify(makeMessage()));
    expect(parseChunkMessage(body)).toBeNull();
  });

  it('rejects malformed JSON', () => {
    expect(parseChunkMessage('{not json')).toBeNull();
  });

  it('rejects a message without scanRunId', () => {
    const message = makeMessage();
    delete (message as Partial<ScanChunkMessage>).scanRunId;
    expect(parseChunkMessage(JSON.stringify(message))).toBeNull();
  });

  it('rejects an unknown market', () => {
    expect(parseChunkMessage(JSON.stringify(makeMessage({ market: 'JP' as 'US' })))).toBeNull();
  });

  it('rejects a message without a tickers array', () => {
    const message = makeMessage();
    delete (message as Partial<ScanChunkMessage>).tickers;
    expect(parseChunkMessage(JSON.stringify(message))).toBeNull();
  });

  it('drops non-string tickers rather than forwarding them to the evaluator', () => {
    const parsed = parseChunkMessage(
      JSON.stringify({ ...makeMessage(), tickers: ['AAPL', 42, null, 'MSFT'] })
    );

    expect(parsed?.tickers).toEqual(['AAPL', 'MSFT']);
  });

  it('never carries telegram credentials through the queue envelope', () => {
    const parsed = parseChunkMessage(
      JSON.stringify({ ...makeMessage(), botToken: 'secret-token', chatId: '-100999' })
    );

    expect(parsed).not.toBeNull();
    expect(parsed).not.toHaveProperty('botToken');
    expect(parsed).not.toHaveProperty('chatId');
  });
});

describe('chunk size contract between orchestrator and processor', () => {
  it.each(['US', 'KR'] as const)('keeps the %s chunk size inside the subrequest budget', (market) => {
    const chunkSize = getOptimalChunkSize(market, true);

    expect(chunkSize).toBeLessThanOrEqual(getChunkSizeLimit(market));
    expect(estimateBudget(chunkSize, true).withinLimits).toBe(true);
  });

  it('never lets the orchestrator build chunks the processor would reject', () => {
    for (const market of ['US', 'KR'] as const) {
      const orchestratorChunkSize = getOptimalChunkSize(market, true);
      const processorMax = getOptimalChunkSize(market, true);

      expect(orchestratorChunkSize).toBeLessThanOrEqual(processorMax);
    }
  });

  it('keeps the worst-case cache-miss chunk within limits for both markets', () => {
    for (const market of ['US', 'KR'] as const) {
      const chunkSize = getOptimalChunkSize(market, false);
      expect(estimateBudget(chunkSize, false).withinLimits).toBe(true);
    }
  });
});
