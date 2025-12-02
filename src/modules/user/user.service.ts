import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { User } from 'prisma/generated/client';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);
  constructor(private readonly prisma: PrismaService) {}

  async getUser(userWalletAddress: string) {
    const normalizedAddress = userWalletAddress.toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { walletAddress: normalizedAddress },
      include: {
        positions: true,
        balance: true,
        autoTrading: true,
      },
    });
    //eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { nonce, ...userWithoutNonce } = user as User;
    if (!userWithoutNonce) {
      throw new NotFoundException('User not found');
    }
    return userWithoutNonce;
  }

  async registerWhitelist(userWalletAddress: string) {
    const normalizedAddress = userWalletAddress.toLowerCase();

    // Check if user exists first
    const existingUser = await this.prisma.user.findUnique({
      where: { walletAddress: normalizedAddress },
    });

    if (!existingUser) {
      throw new NotFoundException('User not found');
    }

    // Update whitelist status
    const user = await this.prisma.user.update({
      where: { walletAddress: normalizedAddress },
      data: { isWhitelisted: true },
    });

    return user;
  }

  async getWhitelist() {
    const whitelist = await this.prisma.user.findMany({
      where: { isWhitelisted: true },
    });
    return whitelist;
  }
}
