import { Module } from '@nestjs/common';
import { MonitoringConfigService } from './monitoring-config.service';
import { MonitoringConfigController } from './monitoring-config.controller';
import { ConfigModule } from '../config/config.module';

@Module({
  imports: [ConfigModule],
  controllers: [MonitoringConfigController],
  providers: [MonitoringConfigService],
  exports: [MonitoringConfigService],
})
export class MonitoringConfigModule {}
