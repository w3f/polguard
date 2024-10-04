import { Module, DynamicModule } from '@nestjs/common';
import { EventEmitterService } from './event-emitter.service';
import { ConfigModule } from '../config/config.module';
import { ConfigService } from '../config/config.service';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';

@Module({})
export class EventEmitterModule {
  static forRootAsync(): DynamicModule {
    return {
      module: EventEmitterModule,
      imports: [ConfigModule],
      providers: [
        {
          provide: 'REDIS_PROXY_CLIENT',
          useFactory: (configService: ConfigService) => {
            const redisConfig = configService.getRedisConfig();
            return ClientProxyFactory.create({
              transport: Transport.REDIS,
              options: redisConfig,
            });
          },
          inject: [ConfigService],
        },
        EventEmitterService,
      ],
      exports: [EventEmitterService],
    };
  }
}
