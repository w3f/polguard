import { Module, DynamicModule } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { ConfigModule } from '../config/config.module';
import { ConfigService } from '../config/config.service';
import { MetricsController } from './metrics.controller';
import { StorageModule } from '../storage/storage.module';
import { StorageService } from '../storage/storage.service';

@Module({})
export class MetricsModule {
  static forRootAsync(): DynamicModule {
    return {
      module: MetricsModule,
      imports: [ConfigModule, StorageModule.forRootAsync()],
      controllers: [MetricsController],
      providers: [
        {
          provide: MetricsService,
          useFactory: async (configService: ConfigService, storageService: StorageService) => {
            const network = configService.getChain();
            const environment = configService.getEnvironment();
            return new MetricsService(network, environment, storageService);
          },
          inject: [ConfigService, StorageService],
        },
      ],
      exports: [MetricsService],
    };
  }
}
