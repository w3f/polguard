import { Logger, Module } from '@nestjs/common';
import { AppService } from './app.service';
import { HealthModule } from './health/health.module';
import { MetricsModule } from './metrics/metrics.module';
import { ConfigModule } from './config/config.module';
import { ConfigService } from './config/config.service';
import { RedisModule } from './redis/redis.module';
import { ChainWatcherStore } from '@lib/store/chain-watcher-store';
import { IncidentHandler } from '@lib/incident/incident-handler';
import { RedisStorageService } from './redis/redis-storage.service';
import { RedisPubSubService } from './redis/redis-pubsub.service';

@Module({
  imports: [
    HealthModule,
    MetricsModule,
    ConfigModule,
    RedisModule.forRootAsync(),
  ],
  providers: [
    Logger,
    AppService,
    {
      provide: ChainWatcherStore,
      useFactory: (redisStorageService: RedisStorageService) => new ChainWatcherStore(redisStorageService),
      inject: [RedisStorageService],
    },
    {
      provide: IncidentHandler,
      useFactory: (store: ChainWatcherStore, configService: ConfigService, pubSub: RedisPubSubService) => 
        new IncidentHandler(store, pubSub, configService.getChain()),
      inject: [ChainWatcherStore, ConfigService, RedisPubSubService],
    },
  ],
})
export class AppModule {}
