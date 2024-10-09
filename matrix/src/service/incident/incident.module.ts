import { Module, DynamicModule } from '@nestjs/common';
import { IncidentService } from './incident.service';
import { ConfigModule } from '../config/config.module';
import { ConfigService } from '../config/config.service';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import { IncidentEventHandlerService } from './incident-handler.service';
import { EventEmitterModule } from '@nestjs/event-emitter';

@Module({})
export class IncidentModule {
  static forRootAsync(): DynamicModule {
    return {
      module: IncidentModule,
      imports: [
        ConfigModule,
        EventEmitterModule.forRoot()
      ],
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
        IncidentService,
        IncidentEventHandlerService
      ],
      exports: [IncidentService, IncidentEventHandlerService],
    };
  }
}
