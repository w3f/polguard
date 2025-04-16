import { Module, DynamicModule } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { ConfigModule } from '../config/config.module';
import { ConfigService } from '../config/config.service';
import { MetricsController } from './metrics.controller';

@Module({})
export class MetricsModule {
  static forRootAsync(): DynamicModule {
    return {
      module: MetricsModule,
      imports: [ConfigModule],
      controllers: [MetricsController],
      providers: [
        {
          provide: MetricsService,
          useFactory: async (configService: ConfigService) => {
            const network = configService.getChain();
            const environment = configService.getEnvironment();
            return new MetricsService(network, environment);
          },
          inject: [ConfigService],
        },
      ],
      exports: [MetricsService],
    };
  }
}
