import { Module, DynamicModule } from '@nestjs/common';
import Redis from 'ioredis';
import { RedisStorageService } from './redis-storage.service';
import { RedisPubSubService } from './redis-pubsub.service';
import { ConfigModule } from '../config/config.module';
import { ConfigService } from '../config/config.service';

@Module({})
export class RedisModule {
  static forRootAsync(): DynamicModule {
    return {
      module: RedisModule,
      imports: [ConfigModule],
      providers: [
        {
          provide: 'REDIS_CLIENT',
          useFactory: (configService: ConfigService) => {
            const redisConfig = configService.getRedisConfig();
            return new Redis(redisConfig);
          },
          inject: [ConfigService],
        },
        RedisStorageService,
        RedisPubSubService,
      ],
      exports: [RedisStorageService, RedisPubSubService],
    };
  }
}
