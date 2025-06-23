import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationService } from './notification.service';
import { Incident } from '../database/incident.entity';
import { Notification } from '../database/notification.entity';
import { ConfigModule } from '../config/config.module';

@Module({
  imports: [HttpModule, TypeOrmModule.forFeature([Incident, Notification]), ConfigModule],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
