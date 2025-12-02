import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { AuthGuard } from '../auth/guard/auth.guard';
import { User } from 'prisma/generated/client';
import { User as UserDecorator } from '../../common/decorators/user.decorator';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get(':walletAddress')
  @UseGuards(AuthGuard)
  async getUser(@Param('walletAddress') userWalletAddress: string) {
    return await this.userService.getUser(userWalletAddress);
  }

  @Patch('register-whitelist')
  @UseGuards(AuthGuard)
  async registerWhitelist(@UserDecorator() user: User) {
    return await this.userService.registerWhitelist(user.walletAddress);
  }
}
