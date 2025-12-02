import { Module } from '@nestjs/common';
import { TaskService } from './task.service';
import { ScheduleModule } from '@nestjs/schedule';
import { MarketModule } from '../market/market.module';
import { AgentModule } from '../agent/agent.module';

@Module({
  imports: [ScheduleModule.forRoot(), MarketModule, AgentModule],
  controllers: [],
  providers: [TaskService],
  exports: [TaskService],
})
export class TaskModule {}
