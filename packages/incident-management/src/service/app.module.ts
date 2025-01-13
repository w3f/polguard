import { Logger, Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';
import { MetricsModule } from './metrics/metrics.module';
import { ConfigModule } from './config/config.module';
import { IncidentController } from './incident/incident.controller';

@Module({
  imports: [HealthModule, MetricsModule, ConfigModule, IncidentController],
  providers: [Logger],
})
export class AppModule {}
