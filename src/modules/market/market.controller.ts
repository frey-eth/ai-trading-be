import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
} from '@nestjs/common';
import { MarketService } from './market.service';
import { Asset } from 'prisma/generated/browser';

@Controller('market')
export class MarketController {
  constructor(private readonly marketService: MarketService) {}

  @Post('add-asset')
  async addAsset(@Body() { symbol }: { symbol: string }) {
    return await this.marketService.addAsset(symbol);
  }

  @Get('all-assets')
  async getAllAssets(): Promise<Asset[]> {
    return await this.marketService.getAllAssets();
  }

  @Get('batch-prices')
  async getBatchPrices(@Query('symbols') symbols: string) {
    const symbolsArray = symbols
      ? symbols
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
      : [];

    if (symbolsArray.length === 0) {
      throw new BadRequestException('At least one symbol is required');
    }

    const priceMap = await this.marketService.getBatchPrices(symbolsArray);
    return Object.fromEntries(priceMap);
  }
}
