import { signalRepository } from '../db/repositories/signalRepository';
import { marketDataRepository } from '../db/repositories/marketDataRepository';

export async function updateSignalOutcomes(): Promise<{ updatedCount: number }> {
  const allSignals = await signalRepository.getAll();
  let updatedCount = 0;

  for (const sig of allSignals) {
    if (sig.is_closed) continue;

    const bars = await marketDataRepository.getBars(sig.ticker, 300);
    if (bars.length === 0) continue;

    const signalBarIndex = bars.findIndex((b) => b.date >= sig.signal_date);
    if (signalBarIndex === -1) continue;

    const entryPrice = sig.signal_price;
    const currentBar = bars[bars.length - 1];
    const currentPrice = currentBar.close;
    const currentReturn = Math.round(((currentPrice - entryPrice) / entryPrice) * 1000) / 10;

    const bar5 = signalBarIndex + 5 < bars.length ? bars[signalBarIndex + 5] : null;
    const bar10 = signalBarIndex + 10 < bars.length ? bars[signalBarIndex + 10] : null;
    const bar20 = signalBarIndex + 20 < bars.length ? bars[signalBarIndex + 20] : null;

    const ret5 = bar5 ? Math.round(((bar5.close - entryPrice) / entryPrice) * 1000) / 10 : sig.return_5d;
    const ret10 = bar10 ? Math.round(((bar10.close - entryPrice) / entryPrice) * 1000) / 10 : sig.return_10d;
    const ret20 = bar20 ? Math.round(((bar20.close - entryPrice) / entryPrice) * 1000) / 10 : sig.return_20d;

    let status = sig.status || 'ACTIVE';
    if (bar20) status = '20D_REACHED';
    else if (bar10) status = '10D_REACHED';
    else if (bar5) status = '5D_REACHED';

    await signalRepository.updateOutcome(sig.id, {
      return_5d: ret5,
      return_10d: ret10,
      return_20d: ret20,
      current_return: currentReturn,
      status,
      is_closed: Boolean(bar20),
    });
    updatedCount++;
  }

  return { updatedCount };
}
