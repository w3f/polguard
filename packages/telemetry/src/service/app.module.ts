import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';
import { WatcherModule } from './watcher/watcher.module';

@Module({
  imports: [HealthModule, WatcherModule],
})
export class AppModule {}
