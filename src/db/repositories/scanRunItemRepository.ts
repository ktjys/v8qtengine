import { dbClient } from '../supabaseClient';
import { ScanRunItem } from '../../types/v8';

export class ScanRunItemRepository {
  async saveItems(items: ScanRunItem[]): Promise<void> {
    if (!items.length) return;

    if (dbClient.isTableAvailable('scan_run_items') && dbClient.supabase) {
      try {
        const payload = items.map((item) => ({
          scan_run_id: item.scan_run_id,
          ticker: item.ticker,
          status: item.status,
          error_code: item.error_code,
          error_message: item.error_message,
          started_at: item.started_at,
          finished_at: item.finished_at,
        });

        const { error } = await dbClient.supabase
          .from('scan_run_items')
          .insert(payload);

        if (error) {
          dbClient.handleDbError('scan_run_items', 'saveItems', error);
        }
      } catch (err) {
        dbClient.handleDbError('scan_run_items', 'saveItems', err);
      }
    }
  }

  async getByScanRunId(scanRunId: string): Promise<ScanRunItem[]> {
    if (dbClient.isTableAvailable('scan_run_items') && dbClient.supabase) {
      try {
        const { data, error } = await dbClient.supabase
          .from('scan_run_items')
          .select('*')
          .eq('scan_run_id', scanRunId)
          .order('started_at', { ascending: true });

        if (error) {
          dbClient.handleDbError('scan_run_items', 'getByScanRunId', error);
        } else if (Array.isArray(data)) {
          return data.map((r: any) => ({
            scan_run_id: r.scan_run_id,
            ticker: r.ticker,
            status: r.status,
            error_code: r.error_code,
            error_message: r.error_message,
            started_at: r.started_at,
            finished_at: r.finished_at,
          }));
        }
      } catch (err) {
        dbClient.handleDbError('scan_run_items', 'getByScanRunId', err);
      }
    }

    return [];
  }

  async getFailedItems(scanRunId: string): Promise<ScanRunItem[]> {
    const items = await this.getByScanRunId(scanRunId);
    return items.filter((item) => item.status === 'FAILED');
  }
}

export const scanRunItemRepository = new ScanRunItemRepository();