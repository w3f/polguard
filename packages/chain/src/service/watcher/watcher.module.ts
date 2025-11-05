import { Logger, Module } from '@nestjs/common';
import { WatcherService } from './watcher.service';
import { ConfigModule } from '../config/config.module';
import { StoreModule } from '../store/store.module';
import { IncidentModule } from '../incident/incident.module';
import { MonitoringConfigModule } from '../monitoring-config/monitoring-config.module';

@Module({
  imports: [
    ConfigModule,
    MonitoringConfigModule.forRootAsync(),
    StoreModule.forRootAsync(),
    IncidentModule.forRootAsync(),
  ],
  providers: [Logger, WatcherService],
  exports: [WatcherService],
})
export class WatcherModule {}
