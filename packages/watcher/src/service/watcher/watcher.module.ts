import { Logger, Module } from '@nestjs/common';
import { WatcherService } from './watcher.service';
import { ConfigModule } from '../config/config.module';
import { MetricsModule } from '../metrics/metrics.module';
import { StorageModule } from '../storage/storage.module';
import { TelemetryModule } from '../telemetry/telemetry.module';
import { IncidentModule } from '../incident/incident.module';

@Module({
  imports: [
    ConfigModule,
    MetricsModule.forRootAsync(),
    StorageModule.forRootAsync(),
    TelemetryModule.forRootAsync(),
    IncidentModule.forRootAsync(),
  ],
  providers: [Logger, WatcherService],
  exports: [WatcherService],
})
export class WatcherModule {}
