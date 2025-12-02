import { Controller, Get, Param } from '@nestjs/common';
import { TradingService } from './trading.service';

@Controller('trading')
export class TradingController {
  constructor(private readonly tradingService: TradingService) {}

  @Get('positions/:walletAddress')
  async getPositions(@Param('walletAddress') walletAddress: string) {
    return this.tradingService.getPositions(walletAddress);
  }
}
