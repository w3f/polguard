import { Module, DynamicModule, Logger } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MonitoringConfigService } from './monitoring-config.service';
import { ConfigModule } from '../config/config.module';

@Module({})
export class MonitoringConfigModule {
  static forRootAsync(): DynamicModule {
    return {
      module: MonitoringConfigModule,
      imports: [ConfigModule, HttpModule],
      providers: [Logger, MonitoringConfigService],
      exports: [MonitoringConfigService],
    };
  }
}
