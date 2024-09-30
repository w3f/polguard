import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigService } from '../config/config.service';
import { RedisService } from './redis.service';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: 'REDIS_CLIENT',
        useFactory: (configService: ConfigService) => ({
          transport: Transport.REDIS,
          options: configService.getRedisConfig(),
        }),
        inject: [ConfigService],
      },
    ]),
  ],
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
