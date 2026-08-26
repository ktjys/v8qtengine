import { dbClient } from '../supabaseClient';
import { ScanRunLog } from '../../types/v8';

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
        } else if (Array.isArray(data)) {
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
          }));
          mapped.forEach((item) => dbClient.scan_runs.set(item.run_id, item));
          return mapped;
        }
      } catch (err) {
        dbClient.handleDbError('scan_runs', 'getAll', err);
      }
    }

    const list = Array.from(dbClient.scan_runs.values());
    return list.sort((a, b) => b.started_at.localeCompare(a.started_at));
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
    dbClient.saveLocalSnapshot();
    return log;
  }

  async getLatest(): Promise<ScanRunLog | null> {
    const list = await this.getAll();
    return list.length > 0 ? list[0] : null;
  }
}

export const scanRunRepository = new ScanRunRepository();
