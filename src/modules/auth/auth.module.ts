import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    JwtModule.registerAsync({
      global: true,
      useFactory: () => ({
        secret: process.env.JWT_SECRET!,
        signOptions: { expiresIn: '30d' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
