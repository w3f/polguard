import { Module, DynamicModule, Logger } from '@nestjs/common';
import { HttpModule, HttpService } from '@nestjs/axios';
import { ConfigModule } from '../config/config.module';
import { ConfigService } from '../config/config.service';
import { InMemoryStore } from './in-memory.store';
import { ServiceStore } from './service.store';
import { FileStore } from './file.store';

@Module({})
export class StoreModule {
  static forRootAsync(): DynamicModule {
    return {
      module: StoreModule,
      imports: [HttpModule, ConfigModule],
      providers: [
        Logger,
        {
          provide: 'Store',
          useFactory: (config: ConfigService, http: HttpService) => {
            const storeConfig = config.getStoreConfig();
            
            switch (storeConfig.type) {
              case 'service':
                return new ServiceStore(http, config);
              case 'file':
                return new FileStore(storeConfig.filePath);
              case 'inMemory':
              default:
                return new InMemoryStore();
            }
          },
          inject: [ConfigService, HttpService],
        },
      ],
      exports: ['Store'],
    };
  }
}
