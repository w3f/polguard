import { Module, DynamicModule, Logger } from '@nestjs/common';
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
        Logger,
        {
          provide: StorageService,
          useFactory: (configService: ConfigService) => {
            const chain = configService.getChain();
            const dataPath = configService.getStorageDataPath();
            return new StorageService(chain, dataPath);
          },
          inject: [ConfigService],
        },
      ],
      exports: [StorageService],
    };
  }
}
