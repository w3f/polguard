import { Module, DynamicModule, Logger } from '@nestjs/common';
import { IncidentPublisherService } from './incident-publisher.service';
import { IncidentController } from './incident.controller';
import { ConfigModule } from '../config/config.module';
import { ConfigService } from '../config/config.service';
import { RedisStreamsModule } from '@w3f/nest-redis-streams';
import { WatcherModule } from '../watcher/watcher.module';
@Module({})
export class IncidentModule {
  static forRootAsync(): DynamicModule {
    return {
      module: IncidentModule,
      imports: [
        ConfigModule,
        WatcherModule,
        RedisStreamsModule.registerAsync({
          imports: [ConfigModule],
          useFactory: async (configService: ConfigService) => {
            const redisConfig = configService.getRedisConfig();
            const chain = configService.getChain();
            return {
              host: redisConfig.host,
              port: redisConfig.port,
              streamName: 'incidents',
              groupName: `watcher-${chain}`,
              consumerName: `watcher-${chain}`,
            };
          },
          inject: [ConfigService],
        }),
      ],
      providers: [Logger, IncidentPublisherService],
      controllers: [IncidentController],
      exports: [IncidentPublisherService],
    };
  }
}
