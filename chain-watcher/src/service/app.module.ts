import { Logger, Module } from '@nestjs/common';
import { AppService } from './app.service';
import { HealthModule } from './health/health.module';
import { MetricsModule } from './metrics/metrics.module';
import { ConfigModule } from './config/config.module';
import { ConfigService } from './config/config.service';
import { StorageModule } from './storage/storage.module';
import { StorageService } from './storage/storage.service';
import { ChainWatcherStore } from '@lib/store/chain-watcher-store';
import { IncidentHandler } from '@lib/incident/incident-handler';
import { EventEmitterModule } from './incident/incident.module';
import { IncidentPublisherService } from './incident/incident-publisher.service';

@Module({
  imports: [
    HealthModule,
    MetricsModule.forRootAsync(),
    ConfigModule,
    StorageModule.forRootAsync(),
    EventEmitterModule.forRootAsync(),
  ],
  providers: [
    Logger,
    AppService,
    {
      provide: ChainWatcherStore,
      useFactory: (storageService: StorageService) => new ChainWatcherStore(storageService),
      inject: [StorageService],
    },
    {
      provide: IncidentHandler,
      useFactory: (store: ChainWatcherStore, configService: ConfigService, eventEmitter: IncidentPublisherService) => 
        new IncidentHandler(new Logger(IncidentHandler.name), store, eventEmitter, configService.getChain()),
      inject: [ChainWatcherStore, ConfigService, IncidentPublisherService],
    },
  ],
})
export class AppModule {}
