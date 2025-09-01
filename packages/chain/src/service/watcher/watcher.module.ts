import { Logger, Module } from '@nestjs/common';
import { WatcherService } from './watcher.service';
import { ConfigModule } from '../config/config.module';
import { StorageModule } from '../storage/storage.module';
import { IncidentModule } from '../incident/incident.module';
import { MonitoringConfigModule } from '../monitoring-config/monitoring-config.module';
import { LastBlockModule } from '../last-block/last-block.module';

@Module({
  imports: [
    ConfigModule,
    MonitoringConfigModule.forRootAsync(),
    LastBlockModule.forRootAsync(),
    StorageModule,
    IncidentModule.forRootAsync(),
  ],
  providers: [Logger, WatcherService],
  exports: [WatcherService],
})
export class WatcherModule {}
