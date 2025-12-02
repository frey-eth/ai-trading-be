export function convertToBinanceSymbol(symbol: string): string {
  // If already contains USDT, return as is
  if (symbol.toUpperCase().includes('USDT')) {
    return symbol.toUpperCase();
  }

  // Common conversions
  const conversions: Record<string, string> = {
    BTC: 'BTCUSDT',
    ETH: 'ETHUSDT',
    SOL: 'SOLUSDT',
    BNB: 'BNBUSDT',
    ADA: 'ADAUSDT',
    XRP: 'XRPUSDT',
    DOT: 'DOTUSDT',
    DOGE: 'DOGEUSDT',
    MATIC: 'MATICUSDT',
    AVAX: 'AVAXUSDT',
  };

  return conversions[symbol.toUpperCase()] || `${symbol.toUpperCase()}USDT`;
}

export function convertInterval(interval: string): string {
  // Binance supports: 1m, 3m, 5m, 15m, 30m, 1h, 2h, 4h, 6h, 8h, 12h, 1d, 3d, 1w, 1M
  return interval;
}
