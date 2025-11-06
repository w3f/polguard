import { Logger, Module } from '@nestjs/common';
import { WatcherService } from './watcher.service';
import { ConfigModule } from '../config/config.module';
import { StoreModule } from '../store/store.module';
import { IncidentReporterModule } from '../reporter/reporter.module';
import { MonitoringConfigModule } from '../monitoring-config/monitoring-config.module';

@Module({
  imports: [
    ConfigModule,
    MonitoringConfigModule.forRootAsync(),
    StoreModule.forRootAsync(),
    IncidentReporterModule.forRootAsync(),
  ],
  providers: [Logger, WatcherService],
  exports: [WatcherService],
})
export class WatcherModule {}
