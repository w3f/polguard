import { Module, Logger } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { TelemetryModule } from './telemetry/telemetry.module';
import { FeedController } from './feed/feed.controller';
import { HealthModule } from './health/health.module';
import { MetricsModule } from './metrics/metrics.module';

@Module({
  imports: [ConfigModule.forRootAsync(), TelemetryModule.forRootAsync(), HealthModule, MetricsModule],
  controllers: [FeedController],
  providers: [Logger],
})
export class AppModule {}
