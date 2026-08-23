export function formatStockPrice(price: number, ticker = ''): string {
  if (typeof price !== 'number' || isNaN(price) || price === 0) {
    return '$0.00';
  }
  const clean = ticker.toUpperCase().trim();
  if (clean.endsWith('.KS') || clean.endsWith('.KQ')) {
    return `₩${Math.round(price).toLocaleString('ko-KR')}`;
  }
  if (price >= 1000) {
    return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `$${price.toFixed(2)}`;
}

export function formatChangePercent(change1d: number): string {
  if (typeof change1d !== 'number' || isNaN(change1d)) {
    return '0.00%';
  }
  const sign = change1d > 0 ? '+' : '';
  return `${sign}${change1d.toFixed(2)}%`;
}
