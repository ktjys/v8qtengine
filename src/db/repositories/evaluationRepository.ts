import { dbClient } from '../supabaseClient';
import { FullTickerEvaluation } from '../../types/v8';

export class EvaluationRepository {
  async saveAll(evaluations: FullTickerEvaluation[]): Promise<void> {
    for (const ev of evaluations) {
      dbClient.evaluations.set(ev.ticker.toUpperCase(), ev);
    }
  }

  async getAll(): Promise<FullTickerEvaluation[]> {
    return Array.from(dbClient.evaluations.values());
  }

  async findByTicker(ticker: string): Promise<FullTickerEvaluation | null> {
    return dbClient.evaluations.get(ticker.toUpperCase().trim()) || null;
  }
}

export const evaluationRepository = new EvaluationRepository();
