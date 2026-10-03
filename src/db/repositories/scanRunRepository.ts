import { dbClient } from '../supabaseClient';
import { ScanRunLog, ScanRunStatus } from '../../types/v8';

export class ScanRunRepository {
  async getAll(): Promise<ScanRunLog[]> {
    if (dbClient.isTableAvailable('scan_runs') && dbClient.supabase) {
      try {
        const { data, error } = await dbClient.supabase
          .from('scan_runs')
          .select('*')
          .order('started_at', { ascending: false });

        if (error) {
          dbClient.handleDbError('scan_runs', 'getAll', error);
        } else if (Array.isArray(data) && data.length > 0) {
          dbClient.scan_runs.clear();
          const mapped: ScanRunLog[] = data.map((r: any) => ({
            run_id: r.id,
            status: r.status,
            started_at: r.started_at,
            finished_at: r.finished_at,
            watchlist_count: r.watchlist_count,
            evaluated_count: r.evaluated_count,
            signal_count: r.signal_count,
            failure_count: r.failure_count || 0,
            failed_tickers: [],
            error_summary: r.error_summary,
            market_region: r.market_region,
            chunk_size: r.chunk_size,
            total_chunks: r.total_chunks,
            completed_chunks: r.completed_chunks,
            failed_chunks: r.failed_chunks,
            meta: r.meta,
          }));
          mapped.forEach((item) => dbClient.scan_runs.set(item.run_id, item));
          return mapped;
        }
      } catch (err) {
        dbClient.handleDbError('scan_runs', 'getAll', err);
      }
    }

    return Array.from(dbClient.scan_runs.values());
  }

  async getById(runId: string): Promise<ScanRunLog | null> {
    if (dbClient.isTableAvailable('scan_runs') && dbClient.supabase) {
      try {
        const { data, error } = await dbClient.supabase
          .from('scan_runs')
          .select('*')
          .eq('id', runId)
          .maybeSingle();

        if (error) {
          dbClient.handleDbError('scan_runs', 'getById', error);
        } else if (data) {
          return {
            run_id: data.id,
            status: data.status,
            started_at: data.started_at,
            finished_at: data.finished_at,
            watchlist_count: data.watchlist_count,
            evaluated_count: data.evaluated_count,
            signal_count: data.signal_count,
            failure_count: data.failure_count || 0,
            failed_tickers: [],
            error_summary: data.error_summary,
            market_region: data.market_region,
            chunk_size: data.chunk_size,
            total_chunks: data.total_chunks,
            completed_chunks: data.completed_chunks,
            failed_chunks: data.failed_chunks,
            meta: data.meta,
          };
        }
      } catch (err) {
        dbClient.handleDbError('scan_runs', 'getById', err);
      }
    }

    return dbClient.scan_runs.get(runId) || null;
  }

  async createChunkedRun(log: ScanRunLog): Promise<ScanRunLog> {
    if (dbClient.isTableAvailable('scan_runs') && dbClient.supabase) {
      const payload = {
        started_at: log.started_at,
        finished_at: log.finished_at,
        watchlist_count: log.watchlist_count,
        evaluated_count: log.evaluated_count,
        signal_count: log.signal_count,
        failure_count: log.failure_count || 0,
        status: log.status,
        error_summary: log.error_summary,
        market_region: log.market_region,
        chunk_size: log.chunk_size,
        total_chunks: log.total_chunks,
        completed_chunks: 0,
        failed_chunks: 0,
        meta: log.meta || {},
      };

      let data: { id?: string } | null = null;
      let failure: any = null;

      try {
        const inserted = await dbClient.supabase
          .from('scan_runs')
          .insert(payload)
          .select('id')
          .maybeSingle();
        data = inserted.data;
        failure = inserted.error;
      } catch (err) {
        failure = err;
      }

      if (failure) {
        dbClient.handleDbError('scan_runs', 'createChunkedRun', failure);
        throw new Error(
          `[db] scan_runs.createChunkedRun failed: ${(failure as any).message || String(failure)}`
        );
      }

      if (data?.id) {
        log.run_id = data.id;
      }
    }

    dbClient.scan_runs.set(log.run_id, log);
    return log;
  }

  async recordChunk(
    runId: string,
    chunkStatus: 'SUCCESS' | 'PARTIAL_SUCCESS' | 'FAILED',
    evaluatedCount: number,
    signalCount: number,
    failureCount: number
  ): Promise<boolean> {
    if (dbClient.isTableAvailable('scan_runs') && dbClient.supabase) {
      try {
        const { data, error } = await dbClient.supabase
          .rpc('record_scan_chunk', {
            p_scan_run_id: runId,
            p_chunk_status: chunkStatus,
            p_evaluated_count: evaluatedCount,
            p_signal_count: signalCount,
            p_failure_count: failureCount,
          });

        if (error) {
          dbClient.handleDbError('scan_runs', 'recordChunk', error);
        }

        return data === true;
      } catch (err) {
        dbClient.handleDbError('scan_runs', 'recordChunk', err);
      }
    }

const local = dbClient.scan_runs.get(runId);
    if (local) {
      local.evaluated_count += evaluatedCount;
      local.signal_count += signalCount;
      local.failure_count += failureCount;
      if (chunkStatus === 'FAILED') {
        local.failed_chunks = (local.failed_chunks ?? 0) + 1;
      } else {
        local.completed_chunks = (local.completed_chunks ?? 0) + 1;
      }
      const settled = (local.completed_chunks ?? 0) + (local.failed_chunks ?? 0);
      if (local.total_chunks && settled >= local.total_chunks) {
        local.status = (local.failed_chunks ?? 0) > 0 ? 'PARTIAL_SUCCESS' : 'SUCCESS';
        local.finished_at = new Date().toISOString();
        return true;
      }
    }
    return false;
  }

  async finalizeRun(
    runId: string,
    patch: { status?: ScanRunStatus; error_summary?: string | null }
  ): Promise<void> {
    if (dbClient.isTableAvailable('scan_runs') && dbClient.supabase) {
      const { error } = await dbClient.supabase
        .from('scan_runs')
        .update({
          ...(patch.status ? { status: patch.status } : {}),
          ...(patch.error_summary !== undefined ? { error_summary: patch.error_summary } : {}),
          finished_at: new Date().toISOString(),
        })
        .eq('id', runId);

      if (error) {
        dbClient.handleDbError('scan_runs', 'finalizeRun', error);
      }
      return;
    }

    const local = dbClient.scan_runs.get(runId);
    if (local) {
      if (patch.status) local.status = patch.status;
      if (patch.error_summary !== undefined) local.error_summary = patch.error_summary;
      local.finished_at = new Date().toISOString();
    }
  }

  async save(log: ScanRunLog): Promise<ScanRunLog> {
    if (dbClient.isTableAvailable('scan_runs') && dbClient.supabase) {
      try {
        const payload = {
          started_at: log.started_at,
          finished_at: log.finished_at,
          watchlist_count: log.watchlist_count,
          evaluated_count: log.evaluated_count,
          signal_count: log.signal_count,
          failure_count: log.failure_count || 0,
          status: log.status,
          error_summary: log.error_summary,
          market_region: log.market_region,
          chunk_size: log.chunk_size,
          total_chunks: log.total_chunks,
          completed_chunks: log.completed_chunks,
          failed_chunks: log.failed_chunks,
          meta: log.meta || {},
        };

        const { data, error } = await dbClient.supabase
          .from('scan_runs')
          .insert(payload)
          .select('id')
          .maybeSingle();

        if (error) {
          dbClient.handleDbError('scan_runs', 'save', error);
        } else if (data?.id) {
          log.run_id = data.id;
        }
      } catch (err) {
        dbClient.handleDbError('scan_runs', 'save', err);
      }
    }

    dbClient.scan_runs.set(log.run_id, log);
    return log;
  }

  async getLatest(): Promise<ScanRunLog | null> {
    const list = await this.getAll();
    return list.length > 0 ? list[0] : null;
  }
}

export const scanRunRepository = new ScanRunRepository();
