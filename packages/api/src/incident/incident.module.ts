import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IncidentController } from './incident.controller';
import { IncidentService } from './incident.service';
import { Incident } from '../database/incident.entity';
import { Notification } from '../database/notification.entity';
import { NotificationModule } from '../notification/notification.module';
import { LastBlockModule } from '../last-block/last-block.module';

@Module({
  imports: [TypeOrmModule.forFeature([Incident, Notification]), NotificationModule, LastBlockModule],
  controllers: [IncidentController],
  providers: [IncidentService],
  exports: [IncidentService],
})
export class IncidentModule {}
