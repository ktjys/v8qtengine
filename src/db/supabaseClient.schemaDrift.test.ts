import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { dbClient } from './supabaseClient';

const UNDEFINED_COLUMN = {
  code: '42703',
  message: 'column scan_runs.market_region does not exist',
};
const UNDEFINED_FUNCTION = {
  code: '42883',
  message: 'function record_scan_chunk(...) does not exist',
};
const UNDEFINED_TABLE = {
  code: '42P01',
  message: 'relation "public.scan_runs" does not exist',
};

describe('handleDbError schema drift classification', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    dbClient.missingTables.clear();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    dbClient.missingTables.clear();
  });

  it('does not disable the table when only a column is unmigrated', () => {
    dbClient.handleDbError('scan_runs', 'createChunkedRun', UNDEFINED_COLUMN);

    expect(dbClient.missingTables.has('scan_runs')).toBe(false);
  });

  it('logs an actionable migration hint for an unmigrated column', () => {
    dbClient.handleDbError('scan_runs', 'createChunkedRun', UNDEFINED_COLUMN);

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('SCHEMA DRIFT'));
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('supabase/migrations/'));
  });

  it('treats PostgREST PGRST202 as drift, not a missing table', () => {
    dbClient.handleDbError('scan_runs', 'recordChunk', {
      code: 'PGRST202',
      message: 'Could not find the function public.record_scan_chunk in the schema cache',
    });

    expect(dbClient.missingTables.has('scan_runs')).toBe(false);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('SCHEMA DRIFT'));
  });

  it('treats an undefined function as drift, not a missing table', () => {
    dbClient.handleDbError('scan_runs', 'recordChunk', UNDEFINED_FUNCTION);

    expect(dbClient.missingTables.has('scan_runs')).toBe(false);
  });

  it('still disables a genuinely missing table', () => {
    dbClient.handleDbError('scan_runs', 'getById', UNDEFINED_TABLE);

    expect(dbClient.missingTables.has('scan_runs')).toBe(true);
  });

  it('does not mark anything missing for an ordinary constraint error', () => {
    dbClient.handleDbError('scan_runs', 'createChunkedRun', {
      code: '42501',
      message: 'row-level security policy violation',
    });

    expect(dbClient.missingTables.has('scan_runs')).toBe(false);
    expect(warnSpy).toHaveBeenCalled();
  });
});
