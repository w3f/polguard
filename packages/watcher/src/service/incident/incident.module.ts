import { Module, DynamicModule } from '@nestjs/common';
import { IncidentPublisherService } from './incident-publisher.service';
import { ConfigModule } from '../config/config.module';
import { ConfigService } from '../config/config.service';
import { RedisStreamsModule } from '@w3f/nest-redis-streams';

@Module({})
export class EventEmitterModule {
  static forRootAsync(): DynamicModule {
    return {
      module: EventEmitterModule,
      imports: [
        ConfigModule,
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
      providers: [IncidentPublisherService],
      exports: [IncidentPublisherService],
    };
  }
}
