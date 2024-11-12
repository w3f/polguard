import { Module, DynamicModule } from '@nestjs/common';
import { IncidentService } from './incident.service';
import { ConfigModule } from '../config/config.module';
import { ConfigService } from '../config/config.service';
import { IncidentController } from './incident.controller';
import { AppModule } from '../app.module';
import { RedisStreamsModule } from '@w3f/nest-redis-streams';

@Module({})
export class IncidentModule {
  static forRootAsync(): DynamicModule {
    return {
      module: IncidentModule,
      imports: [
        ConfigModule,
        AppModule,
        RedisStreamsModule.registerAsync({
          imports: [ConfigModule],
          useFactory: async (configService: ConfigService) => {
            const redisConfig = configService.getRedisConfig();
            return {
              host: redisConfig.host,
              port: redisConfig.port,
              streamName: 'incidents',
              groupName: 'matrix',
              consumerName: 'matrix',
            };
          },
          inject: [ConfigService],
        }),
      ],
      controllers: [IncidentController],
      providers: [IncidentService],
      exports: [IncidentService],
    };
  }
}
