/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Position } from 'prisma/generated/client';

@Injectable()
export class TradingService {
  private readonly logger = new Logger(TradingService.name);
  constructor(private readonly prisma: PrismaService) {}

  async createPosition(userWalletAddress: string, position: Position) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { walletAddress: userWalletAddress },
      });
      if (!user) {
        throw new NotFoundException('User not found');
      }

      const asset = await this.prisma.asset.findUnique({
        where: { id: position.assetId },
      });
      if (!asset) {
        throw new NotFoundException('Asset not found');
      }
      const newPosition = await this.prisma.position.create({
        data: {
          userWalletAddress: user.walletAddress,

          assetId: asset!.id,
          side: position.side,
          openPrice: Number(asset!.price),
          quantity: position.quantity,
          leverage: position.leverage,
          reason: position.reason ? `${position.reason}` : 'Manual trading',
        },
      });
      return {
        success: true,
        message: 'Position created successfully',
        data: newPosition,
      };
    } catch (error) {
      this.logger.error(error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to create position');
    }
  }
  async closePosition(positionId: number) {
    try {
      const position = await this.prisma.position.findUnique({
        where: { id: positionId },
        include: { user: true, asset: true },
      });
      if (!position) {
        throw new NotFoundException('Position not found');
      }

      // Check if position is already closed
      if (position.closedAt) {
        throw new InternalServerErrorException('Position is already closed');
      }

      const closedPosition = await this.prisma.position.update({
        where: { id: positionId },
        data: {
          closedAt: new Date(),

          closePrice: Number(position.asset.price),
        },
      });
      return {
        success: true,
        message: 'Position closed successfully',
        data: closedPosition,
      };
    } catch (error) {
      this.logger.error(error);
      if (
        error instanceof NotFoundException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to close position');
    }
  }
  async getPositions(userWalletAddress: string) {
    try {
      const positions = await this.prisma.position.findMany({
        where: { userWalletAddress: userWalletAddress.toLowerCase() },
        include: {
          asset: true,
          user: {
            select: {
              walletAddress: true,
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
      return {
        success: true,
        message: 'Positions retrieved successfully',
        data: positions,
      };
    } catch (error) {
      this.logger.error(error);
      throw new InternalServerErrorException('Failed to get positions');
    }
  }
}
