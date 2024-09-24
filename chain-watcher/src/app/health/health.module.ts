import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { MetricsModule } from '../metrics/metrics.module';

@Module({
  imports: [TerminusModule, MetricsModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
