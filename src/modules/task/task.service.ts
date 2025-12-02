/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/require-await */
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression, Interval } from '@nestjs/schedule';
import { PrismaService } from '../database/prisma.service';
import { MarketService } from '../market/market.service';
import { AgentService } from '../agent/agent.service';
import { Asset } from 'prisma/generated/client';
import { TechnicalIndicators, MarketDataPoint } from 'src/common/types';
import { TECHNICAL_ANALYSIS_TEMPLATE } from '../agent/templates';
import { TradingService } from '../trading/trading.service';

@Injectable()
export class TaskService {
  private readonly logger = new Logger(TaskService.name);
  private isAnalyzing = false;
  constructor(
    private readonly prisma: PrismaService,
    private readonly marketService: MarketService,
    private readonly agentService: AgentService,
    private readonly tradingService: TradingService,
  ) {}

  @Interval(10000)
  async handleUpdateAssetPrices() {
    try {
      const assets = await this.prisma.asset.findMany();

      if (assets.length === 0) {
        return { updated: 0 };
      }

      const batchPrices = await this.marketService.getBatchPrices(
        assets.map((asset) => asset.symbol),
      );

      // Update each asset individually since we need different prices for each
      const updatePromises = assets.map(async (asset) => {
        const newPrice = batchPrices.get(asset.symbol);
        if (newPrice !== undefined) {
          return this.prisma.asset.update({
            where: { symbol: asset.symbol },
            data: { price: newPrice },
          });
        }
        return null;
      });

      const results = await Promise.all(updatePromises);
      const updatedCount = results.filter((r) => r !== null).length;

      return { updated: updatedCount };
    } catch (error) {
      this.logger.error(`Error updating asset prices: ${error}`);
      throw error;
    }
  }

  @Interval(15 * 1000)
  async analyeMarket() {
    if (this.isAnalyzing) {
      this.logger.debug('Already analyzing market');
      return;
    }
    try {
      this.isAnalyzing = true;
      const assets = await this.marketService.getAllAssets();
      const results = await Promise.all(
        assets.map((asset) => this.analyzeAsset(asset)),
      );
      this.logger.debug(`Analyzed ${results.length} assets successfully`);
      this.isAnalyzing = false;
    } catch (error) {
      this.logger.error(`Error auto trading: ${error}`);
      throw error;
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_11PM)
  async snapShotUserBalance() {
    try {
      this.logger.log('Starting daily balance snapshot at 11 PM');
      const users = await this.prisma.user.findMany();

      if (users.length === 0) {
        this.logger.debug('No users found for balance snapshot');
        return { snapshots: 0 };
      }

      const snapshotPromises = users.map(async (user) => {
        try {
          const balance = await this.prisma.balance.findUnique({
            where: { userWalletAddress: user.walletAddress },
          });

          if (!balance) {
            this.logger.warn(
              `No balance found for user ${user.walletAddress}, skipping snapshot`,
            );
            return null;
          }

          const snapshot = await this.prisma.balanceHistory.create({
            data: {
              balanceId: balance.id,
              amount: balance.balance,
            },
          });

          this.logger.debug(
            `Snapshot created for user ${user.walletAddress}: ${balance.balance}`,
          );
          return snapshot;
        } catch (error) {
          this.logger.error(
            `Error creating snapshot for user ${user.walletAddress}: ${error}`,
          );
          // Don't throw - continue with other users
          return null;
        }
      });

      const results = await Promise.all(snapshotPromises);
      const successCount = results.filter((r) => r !== null).length;

      this.logger.log(
        `Balance snapshot completed: ${successCount}/${users.length} users snapshotted`,
      );
      return { snapshots: successCount, total: users.length };
    } catch (error) {
      this.logger.error(`Error snapping user balance: ${error}`);
      throw error;
    }
  }

  private async analyzeAsset(asset: Asset) {
    try {
      const indicators = await this.marketService.getTechnicalIndicators(
        asset.symbol,
      );

      // Check if indicators were successfully retrieved
      if (!indicators || !indicators.indicators) {
        this.logger.warn(
          `No indicators available for ${asset.symbol}, skipping analysis`,
        );
        return null;
      }

      const analysis = await this.analyzeTechnicalData({
        symbol: asset.symbol,
        indicators: indicators.indicators,
        priceData: indicators.klines,
      });

      this.logger.debug(
        `Analysis for ${asset.symbol}: ${JSON.stringify(analysis)}`,
      );
      return analysis;
    } catch (error) {
      this.logger.error(`Error analyzing asset ${asset.symbol}: ${error}`);
      // Don't throw - allow other assets to be analyzed
      return null;
    }
  }

  private async analyzeTechnicalData(data: {
    symbol: string;
    indicators: TechnicalIndicators;
    priceData: MarketDataPoint[];
  }): Promise<string> {
    try {
      const currentPrice =
        data.priceData[data.priceData.length - 1]?.close || 0;
      const priceAction = data.priceData
        .slice(-5)
        .map(
          (p: MarketDataPoint) =>
            `${p.timestamp instanceof Date ? p.timestamp.toISOString() : String(p.timestamp)}: O:${p.open} H:${p.high} L:${p.low} C:${p.close}`,
        )
        .join('\n');

      const result = await this.agentService.callAgent(
        TECHNICAL_ANALYSIS_TEMPLATE,
        {
          symbol: data.symbol,
          currentPrice: currentPrice.toFixed(2),
          rsi: data.indicators.rsi.toFixed(2),
          macd: JSON.stringify(data.indicators.macd),
          sma20: data.indicators.sma20.toFixed(2),
          sma50: data.indicators.sma50.toFixed(2),
          bbUpper: data.indicators.bollingerBands.upper.toFixed(2),
          bbMiddle: data.indicators.bollingerBands.middle.toFixed(2),
          bbLower: data.indicators.bollingerBands.lower.toFixed(2),
          priceAction,
        },
      );

      return result;
    } catch (error) {
      this.logger.error(`Error in technical analysis: ${error.message}`);
      throw error;
    }
  }
}
