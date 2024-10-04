import { Module, DynamicModule } from '@nestjs/common';
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
            const redisConfig = configService.getRedisConfig();
            return new Redis(redisConfig);
          },
          inject: [ConfigService],
        },
        StorageService,
      ],
      exports: [StorageService],
    };
  }
}
