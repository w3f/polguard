import { Logger, Module } from '@nestjs/common';
import { AppService } from './app.service';
import { HealthModule } from './health/health.module';
import { MetricsModule } from './metrics/metrics.module';
import { ConfigModule } from './config/config.module';
import { StorageModule } from './storage/storage.module';
import { EventEmitterModule } from './incident/incident.module';
import { TelemetryModule } from './telemetry/telemetry.module';

@Module({
  imports: [
    HealthModule,
    MetricsModule.forRootAsync(),
    ConfigModule,
    StorageModule.forRootAsync(),
    EventEmitterModule.forRootAsync(),
    TelemetryModule.forRootAsync(),
  ],
  providers: [Logger, AppService],
})
export class AppModule {}
