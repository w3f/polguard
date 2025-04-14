import { Logger, Module } from '@nestjs/common';
import { WatcherService } from './watcher.service';
import { ConfigModule } from '../config/config.module';
import { MetricsModule } from '../metrics/metrics.module';
import { StorageModule } from '../storage/storage.module';
import { TelemetryModule } from '../telemetry/telemetry.module';
import { IncidentModule } from '../incident/incident.module';
import { MonitoringConfigModule } from '../monitoring-config/monitoring-config.module';

@Module({
  imports: [
    ConfigModule,
    MonitoringConfigModule.forRootAsync(),
    MetricsModule.forRootAsync(),
    StorageModule.forRootAsync(),
    TelemetryModule.forRootAsync(),
    IncidentModule.forRootAsync(),
  ],
  providers: [Logger, WatcherService],
  exports: [WatcherService],
})
export class WatcherModule {}
