import { Logger, Module } from '@nestjs/common';
import { WatcherService } from './watcher.service';
import { ConfigModule } from '../config/config.module';
import { MetricsModule } from '../metrics/metrics.module';
import { StorageModule } from '../storage/storage.module';
import { IncidentModule } from '../incident/incident.module';
import { MonitoringConfigModule } from '../monitoring-config/monitoring-config.module';

@Module({
  imports: [
    ConfigModule,
    MetricsModule.forRootAsync(),
    MonitoringConfigModule.forRootAsync(),
    StorageModule.forRootAsync(),
    IncidentModule.forRootAsync(),
  ],
  providers: [Logger, WatcherService],
  exports: [WatcherService],
})
export class WatcherModule {}
