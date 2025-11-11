import { Logger, Module } from '@nestjs/common';
import { WatcherService } from './watcher.service';
import { ConfigModule } from '../config/config.module';
import { StoreModule } from '../store/store.module';
import { IncidentReporterModule } from '../reporter/reporter.module';
import { ChainTelemetryService } from '../telemetry/chain-telemetry.service';

@Module({
  imports: [ConfigModule, StoreModule.forRootAsync(), IncidentReporterModule.forRootAsync()],
  providers: [Logger, ChainTelemetryService, WatcherService],
  exports: [WatcherService],
})
export class WatcherModule {}
