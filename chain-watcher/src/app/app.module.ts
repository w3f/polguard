import { Logger, Module } from '@nestjs/common';
import { AppService } from './app.service';
import { HealthModule } from './health/health.module';
import { MetricsModule } from './metrics/metrics.module';
import { ConfigModule } from './config/config.module';
import { ConfigService } from './config/config.service';
import { RedisModule } from './redis/redis.module';
import { ChainWatcherStore } from '@core/store/chain-watcher-store';
import { IncidentHandler } from '@core/incident/incident-handler';

@Module({
  imports: [
    HealthModule,
    MetricsModule,
    ConfigModule,
    RedisModule,
  ],
  providers: [
    Logger,
    AppService,
    {
      provide: ChainWatcherStore,
      useFactory: (redisClient) => new ChainWatcherStore(redisClient),
      inject: ['REDIS_CLIENT'],
    },
    {
      provide: IncidentHandler,
      useFactory: (store: ChainWatcherStore, configService: ConfigService) => 
        new IncidentHandler(store, configService.getChain()),
      inject: [ChainWatcherStore, ConfigService],
    },
  ],
})
export class AppModule {}
