/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { MarketDataPoint, TechnicalIndicators } from 'src/common/types';
import { convertInterval, convertToBinanceSymbol } from 'src/utils/utils';
import { PrismaService } from '../database/prisma.service';
import { Asset } from 'prisma/generated/browser';

@Injectable()
export class MarketService {
  private readonly logger = new Logger(MarketService.name);
  private readonly baseUrl = 'https://api.binance.com/api/v3';
  constructor(private readonly prisma: PrismaService) {}

  async addAsset(symbol: string) {
    try {
      const binanceSymbol = convertToBinanceSymbol(symbol);
      const response = await axios.get<{ symbol: string; price: string }>(
        `${this.baseUrl}/ticker/price`,
        {
          params: {
            symbol: binanceSymbol,
          },
        },
      );
      const newAsset = await this.prisma.asset.create({
        data: {
          symbol: binanceSymbol,
          name: symbol,
          price: parseFloat(response.data.price),
        },
      });

      return {
        success: true,
        message: 'Asset added successfully',
        data: newAsset,
      };
    } catch (error) {
      this.logger.error(`Error adding asset: ${error}`);
      throw error;
    }
  }

  async getAllAssets(): Promise<Asset[]> {
    const assets = await this.prisma.asset.findMany();
    return assets as Asset[];
  }

  async getBatchPrices(symbols: string[]): Promise<Map<string, number>> {
    try {
      const binanceSymbols = symbols.map((s) => convertToBinanceSymbol(s));

      const response = await axios.get(`${this.baseUrl}/ticker/price`);
      const allPrices: Array<{ symbol: string; price: string }> =
        response.data as Array<{ symbol: string; price: string }>;

      const priceMap = new Map<string, number>();

      binanceSymbols.forEach((binanceSymbol) => {
        const priceData = allPrices.find((p) => p.symbol === binanceSymbol);
        if (priceData) {
          priceMap.set(binanceSymbol, parseFloat(priceData.price));
        }
      });
      return priceMap;
    } catch (error) {
      this.logger.error(`Error fetching batch prices: ${error}`);
      throw error;
    }
  }

  async getKlines(
    symbol: string,
    interval: string = '1h',
    limit: number = 200,
  ): Promise<MarketDataPoint[]> {
    try {
      const binanceSymbol = convertToBinanceSymbol(symbol);
      const response = await axios.get(`${this.baseUrl}/klines`, {
        params: {
          symbol: binanceSymbol,
          interval: convertInterval(interval),
          limit,
        },
      });
      const klines = response.data as Array<
        [
          number,
          string,
          string,
          string,
          string,
          string,
          string,
          string,
          string,
          string,
        ]
      >;
      return klines.map((kline) => ({
        symbol: binanceSymbol,
        timestamp: new Date(kline[0]),
        open: parseFloat(kline[1]),
        high: parseFloat(kline[2]),
        low: parseFloat(kline[3]),
        close: parseFloat(kline[4]),
        volume: parseFloat(kline[5]),
      })) as MarketDataPoint[];
    } catch (error) {
      this.logger.error(`Error fetching klines: ${error}`);
      throw error;
    }
  }

  async get24hrTicker(symbol: string) {
    try {
      const binanceSymbol = convertToBinanceSymbol(symbol);

      const response = await axios.get(`${this.baseUrl}/ticker/24hr`, {
        params: {
          symbol: binanceSymbol,
        },
      });

      const data = response.data as {
        symbol: string;
        priceChange: string;
        priceChangePercent: string;
        lastPrice: string;
        highPrice: string;
        lowPrice: string;
        volume: string;
        quoteVolume: string;
      };

      return {
        symbol: binanceSymbol,
        priceChange: parseFloat(data.priceChange),
        priceChangePercent: parseFloat(data.priceChangePercent),
        lastPrice: parseFloat(data.lastPrice),
        highPrice: parseFloat(data.highPrice),
        lowPrice: parseFloat(data.lowPrice),
        volume: parseFloat(data.volume),
        quoteVolume: parseFloat(data.quoteVolume),
      };
    } catch (error) {
      this.logger.error(`Error fetching 24hr ticker for ${symbol}: ${error}`);
      throw error;
    }
  }

  async getTechnicalIndicators(symbol: string): Promise<{
    indicators: TechnicalIndicators;
    last24hData: any;
    klines: MarketDataPoint[];
  } | null> {
    try {
      let indicators: TechnicalIndicators | null = null;
      const [data, last24hData] = await Promise.all([
        this.getKlines(symbol, '1h', 200),
        this.get24hrTicker(symbol),
      ]);
      indicators = this.calculateIndicators(data);
      return { indicators, last24hData, klines: data };
    } catch (error) {
      this.logger.error(
        `Error fetching technical indicators for ${symbol}: ${error}`,
      );
      throw error;
    }
  }

  calculateIndicators(data: MarketDataPoint[]): TechnicalIndicators {
    const closes = data.map((d) => d.close);
    return {
      rsi: this.calculateRSI(closes, 14),
      macd: this.calculateMACD(closes),
      sma20: this.calculateSMA(closes, 20),
      sma50: this.calculateSMA(closes, 50),
      ema12: this.calculateEMA(closes, 12),
      ema26: this.calculateEMA(closes, 26),
      bollingerBands: this.calculateBollingerBands(closes, 20, 2),
    };
  }

  private calculateRSI(prices: number[], period: number = 14): number {
    if (prices.length < period + 1) return 50;

    let gains = 0;
    let losses = 0;

    for (let i = prices.length - period; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      if (change > 0) gains += change;
      else losses -= change;
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - 100 / (1 + rs);
  }

  private calculateSMA(prices: number[], period: number): number {
    const slice = prices.slice(-period);
    return slice.reduce((sum, price) => sum + price, 0) / slice.length;
  }

  private calculateEMA(prices: number[], period: number): number {
    const multiplier = 2 / (period + 1);
    let ema = this.calculateSMA(prices.slice(0, period), period);

    for (let i = period; i < prices.length; i++) {
      ema = (prices[i] - ema) * multiplier + ema;
    }

    return ema;
  }

  private calculateMACD(prices: number[]): {
    macd: number;
    signal: number;
    histogram: number;
  } {
    const ema12 = this.calculateEMA(prices, 12);
    const ema26 = this.calculateEMA(prices, 26);
    const macd = ema12 - ema26;
    const signal = macd * 0.9;
    const histogram = macd - signal;

    return { macd, signal, histogram };
  }

  private calculateBollingerBands(
    prices: number[],
    period: number,
    stdDev: number,
  ): { upper: number; middle: number; lower: number } {
    const middle = this.calculateSMA(prices, period);
    const slice = prices.slice(-period);
    const variance =
      slice.reduce((sum, price) => sum + Math.pow(price - middle, 2), 0) /
      period;
    const standardDeviation = Math.sqrt(variance);

    return {
      upper: middle + standardDeviation * stdDev,
      middle,
      lower: middle - standardDeviation * stdDev,
    };
  }
}
