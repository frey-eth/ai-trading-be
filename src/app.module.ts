import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AgentModule } from './modules/agent/agent.module';
import { UserModule } from './modules/user/user.module';
import { DatabaseModule } from './modules/database/databse.module';
import { MarketModule } from './modules/market/market.module';
import { AuthModule } from './modules/auth/auth.module';
import { TradingModule } from './modules/trading/trading.module';
import { TaskModule } from './modules/task/task.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    AgentModule,
    UserModule,
    MarketModule,
    AuthModule,
    TradingModule,
    TaskModule,
  ],
  providers: [],
})
export class AppModule {}
