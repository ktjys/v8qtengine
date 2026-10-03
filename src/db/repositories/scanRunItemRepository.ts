import { dbClient } from '../supabaseClient';
import type { ScanRunItem } from '../../types/v8';

interface ScanRunItemRow {
  scan_run_id: string;
  ticker: string;
  status: string;
  error_code: string | null;
  error_message: string | null;
  started_at: string;
  finished_at: string;
}

function toPayload(item: ScanRunItem): ScanRunItemRow {
  return {
    scan_run_id: item.scan_run_id,
    ticker: item.ticker,
    status: item.status,
    error_code: item.error_code ?? null,
    error_message: item.error_message ?? null,
    started_at: item.started_at,
    finished_at: item.finished_at,
  };
}

function fromRow(row: Record<string, unknown>): ScanRunItem {
  return {
    scan_run_id: String(row.scan_run_id),
    ticker: String(row.ticker),
    status: row.status as ScanRunItem['status'],
    error_code: (row.error_code as string | null) ?? undefined,
    error_message: (row.error_message as string | null) ?? undefined,
    started_at: String(row.started_at),
    finished_at: String(row.finished_at),
  };
}

export class ScanRunItemRepository {
  async saveItems(items: ScanRunItem[]): Promise<void> {
    if (items.length === 0) return;
    if (!dbClient.isTableAvailable('scan_run_items') || !dbClient.supabase) return;

    try {
      const payload = items.map(toPayload);
      const { error } = await dbClient.supabase.from('scan_run_items').insert(payload);
      if (error) {
        dbClient.handleDbError('scan_run_items', 'saveItems', error);
      }
    } catch (err) {
      dbClient.handleDbError('scan_run_items', 'saveItems', err);
    }
  }

  async getByScanRunId(scanRunId: string): Promise<ScanRunItem[]> {
    if (!dbClient.isTableAvailable('scan_run_items') || !dbClient.supabase) return [];

    try {
      const { data, error } = await dbClient.supabase
        .from('scan_run_items')
        .select('*')
        .eq('scan_run_id', scanRunId)
        .order('started_at', { ascending: true });

      if (error) {
        dbClient.handleDbError('scan_run_items', 'getByScanRunId', error);
        return [];
      }
      if (Array.isArray(data)) {
        return data.map((row: Record<string, unknown>) => fromRow(row));
      }
    } catch (err) {
      dbClient.handleDbError('scan_run_items', 'getByScanRunId', err);
    }

    return [];
  }

  async getFailedItems(scanRunId: string): Promise<ScanRunItem[]> {
    const items = await this.getByScanRunId(scanRunId);
    return items.filter((item) => item.status === 'FAILED');
  }

  async countByScanRunId(scanRunId: string): Promise<{ total: number; failed: number }> {
    const items = await this.getByScanRunId(scanRunId);
    return {
      total: items.length,
      failed: items.filter((item) => item.status === 'FAILED').length,
    };
  }
}

export const scanRunItemRepository = new ScanRunItemRepository();
