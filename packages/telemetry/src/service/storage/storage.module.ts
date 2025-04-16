import { Module, DynamicModule, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { StorageService } from './storage.service';
import { ConfigModule } from '../config/config.module';
import { ConfigService } from '../config/config.service';

@Module({})
export class StorageModule {
  static forRootAsync(): DynamicModule {
    return {
      module: StorageModule,
      imports: [ConfigModule],
      providers: [
        {
          provide: 'REDIS_CLIENT',
          useFactory: (configService: ConfigService) => {
            const logger = new Logger('RedisClient');
            const redisConfig = configService.getRedisConfig();
            const client = new Redis(redisConfig);
            client.on('error', error => {
              logger.error(error);
              process.exit(1);
            });

            return client;
          },
          inject: [ConfigService],
        },
        StorageService,
      ],
      exports: [StorageService],
    };
  }
}
