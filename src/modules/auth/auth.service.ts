import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { UserLoginDto } from './dto/user-login.dto';
import { ethers } from 'ethers';
import { randomBytes } from 'crypto';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly MESSAGE_PREFIX = 'Sign in to AI Trading\n\n';
  constructor(
    private readonly prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  /**
   * Generate a nonce for a wallet address
   * This should be called before login to get a nonce for the user to sign
   */
  async getNonce(walletAddress: string): Promise<string> {
    const normalizedAddress = walletAddress.toLowerCase();
    console.log('Normalized Address:', normalizedAddress);
    // Generate a random nonce
    const nonce = randomBytes(32).toString('hex');

    // Get or create user and update nonce
    await this.prisma.user.upsert({
      where: { walletAddress: normalizedAddress },
      update: { nonce },
      create: {
        walletAddress: normalizedAddress,
        nonce,
        balance: {
          create: {},
        },
      },
    });

    return nonce;
  }

  /**
   * Get the message that should be signed by the user
   */
  getSignMessage(nonce: string): string {
    return `${this.MESSAGE_PREFIX}Nonce: ${nonce}`;
  }

  async login(userLoginDto: UserLoginDto) {
    const { walletAddress, signature, message, region } = userLoginDto;

    try {
      const normalizedAddress = walletAddress.toLowerCase();

      // Get user to verify nonce
      const user = await this.prisma.user.findUnique({
        where: { walletAddress: normalizedAddress },
      });

      if (!user || !user.nonce) {
        throw new UnauthorizedException(
          'User not found. Please request a nonce first.',
        );
      }

      // Verify signature
      const verified = this.verifySignature(
        normalizedAddress,
        signature,
        message,
        user.nonce,
      );

      if (!verified) {
        throw new UnauthorizedException('Invalid signature');
      }

      // Generate new nonce after successful login to prevent replay attacks
      const newNonce = randomBytes(32).toString('hex');

      // Update user (create if doesn't exist, update if exists)
      const updatedUser = await this.prisma.user.upsert({
        where: { walletAddress: normalizedAddress },
        update: {
          nonce: newNonce,
          region: region ?? 'us',
        },
        create: {
          walletAddress: normalizedAddress,
          region: region ?? 'us',
          nonce: newNonce,
        },
      });

      // Remove sensitive data before returning
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { nonce, ...userWithoutNonce } = updatedUser;

      const payload = {
        sub: updatedUser.id,
        walletAddress: updatedUser.walletAddress,
      };
      return {
        accessToken: await this.jwtService.signAsync(payload),
        refreshToken: await this.jwtService.signAsync(payload, {
          expiresIn: '30d',
        }),
        user: userWithoutNonce,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Error logging in user ${walletAddress}: ${errorMessage}`,
      );

      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException('Authentication failed');
    }
  }

  /**
   * Verify EVM wallet signature
   * @param walletAddress - The wallet address that signed the message
   * @param signature - The signature from the wallet
   * @param message - The message that was signed
   * @param expectedNonce - The expected nonce in the message
   * @returns true if signature is valid, false otherwise
   */
  private verifySignature(
    walletAddress: string,
    signature: string,
    message: string,
    expectedNonce: string,
  ): boolean {
    try {
      // Verify that the message contains the expected nonce
      if (!message.includes(expectedNonce)) {
        this.logger.warn(
          `Nonce mismatch. Expected: ${expectedNonce}, Message: ${message}`,
        );
        return false;
      }

      // Recover the address from the signature
      // ethers.verifyMessage handles EIP-191 personal_sign message hashing automatically
      const recoveredAddress = ethers.verifyMessage(message, signature);

      // Compare addresses (case-insensitive)
      const isValid =
        recoveredAddress.toLowerCase() === walletAddress.toLowerCase();

      if (!isValid) {
        this.logger.warn(
          `Address mismatch. Expected: ${walletAddress}, Recovered: ${recoveredAddress}`,
        );
      }

      return isValid;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error verifying signature: ${errorMessage}`);
      return false;
    }
  }
}
