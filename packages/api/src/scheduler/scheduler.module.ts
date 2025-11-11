import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SchedulerService } from './scheduler.service';
import { NotificationModule } from '../notification/notification.module';
import { IncidentModule } from '../incident/incident.module';
import { ConfigModule } from '../config/config.module';

@Module({
  imports: [ScheduleModule.forRoot(), ConfigModule, NotificationModule, IncidentModule],
  providers: [SchedulerService],
})
export class SchedulerModule {}
