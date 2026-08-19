import { dbClient } from '../supabaseClient';
import { ScanRunLog } from '../../types/v8';

export class ScanRunRepository {
  async getAll(): Promise<ScanRunLog[]> {
    const list = Array.from(dbClient.scan_runs.values());
    return list.sort((a, b) => b.started_at.localeCompare(a.started_at));
  }

  async save(log: ScanRunLog): Promise<ScanRunLog> {
    dbClient.scan_runs.set(log.run_id, log);
    return log;
  }

  async getLatest(): Promise<ScanRunLog | null> {
    const list = await this.getAll();
    return list.length > 0 ? list[0] : null;
  }
}

export const scanRunRepository = new ScanRunRepository();
