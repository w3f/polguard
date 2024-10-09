import { Logger, Module } from '@nestjs/common';
import { AppService } from './app.service';
import { HealthModule } from './health/health.module';
import { MetricsModule } from './metrics/metrics.module';
import { ConfigModule } from './config/config.module';
import { IncidentModule } from './incident/incident.module';

@Module({
  imports: [
    HealthModule,
    MetricsModule,
    ConfigModule,
    IncidentModule.forRootAsync(),
  ],
  providers: [
    Logger,
    AppService,
  ],
})
export class AppModule {}
