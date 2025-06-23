import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MonitoringConfigService } from './monitoring-config.service';
import { ConfigModule } from '../config/config.module';

@Module({
  imports: [HttpModule, ConfigModule],
  providers: [MonitoringConfigService],
  exports: [MonitoringConfigService],
})
export class MonitoringConfigModule {}
