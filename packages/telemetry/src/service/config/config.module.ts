import { Module, Logger, DynamicModule } from '@nestjs/common';
import { ConfigService } from './config.service';

@Module({})
export class ConfigModule {
  static forRootAsync(): DynamicModule {
    return {
      module: ConfigModule,
      providers: [
        Logger,
        {
          provide: ConfigService,
          useFactory: async (logger: Logger) => {
            const config = new ConfigService(logger);
            await config.initialize();
            return config;
          },
          inject: [Logger],
        },
      ],
      exports: [ConfigService],
      global: true, // Make config available everywhere
    };
  }
}
