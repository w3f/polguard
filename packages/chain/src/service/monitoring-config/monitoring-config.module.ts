import { Module, DynamicModule, Logger } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MonitoringConfigService } from './monitoring-config.service';
import { ConfigModule } from '../config/config.module';
import { MetricsModule } from '../metrics/metrics.module';

@Module({})
export class MonitoringConfigModule {
  static forRootAsync(): DynamicModule {
    return {
      module: MonitoringConfigModule,
      imports: [ConfigModule, HttpModule, MetricsModule.forRootAsync()],
      providers: [Logger, MonitoringConfigService],
      exports: [MonitoringConfigService],
    };
  }
}
