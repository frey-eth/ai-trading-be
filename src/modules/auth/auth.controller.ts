import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { UserLoginDto } from './dto/user-login.dto';
import { AuthGuard } from './guard/auth.guard';
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Get nonce for wallet address
   * GET /auth/nonce?walletAddress=0x...
   */
  @Get('nonce')
  async getNonce(@Query('walletAddress') walletAddress: string) {
    if (!walletAddress) {
      throw new BadRequestException('walletAddress is required');
    }
    const nonce = await this.authService.getNonce(walletAddress);
    const message = this.authService.getSignMessage(nonce);
    return {
      nonce,
      message,
    };
  }

  /**
   * Login with wallet signature
   * POST /auth/login
   */
  @Post('login')
  async login(@Body() userLoginDto: UserLoginDto) {
    return await this.authService.login(userLoginDto);
  }

  @UseGuards(AuthGuard)
  @Get('me')
  getProfile(@Request() req) {
    //eslint-disable-next-line
    return req.user;
  }
}
