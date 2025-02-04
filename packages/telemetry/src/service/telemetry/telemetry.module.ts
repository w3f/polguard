import { Module, Logger, DynamicModule } from '@nestjs/common';
import { TelemetryService } from './telemetry.service';
import { ConfigModule } from '../config/config.module';
import { ConfigService } from '../config/config.service';

@Module({})
export class TelemetryModule {
  static forRootAsync(): DynamicModule {
    return {
      module: TelemetryModule,
      imports: [ConfigModule],
      providers: [
        Logger,
        {
          provide: TelemetryService,
          useFactory: async (config: ConfigService, logger: Logger) => {
            const service = new TelemetryService(config, logger);
            await service.initialize();
            return service;
          },
          inject: [ConfigService, Logger],
        },
      ],
      exports: [TelemetryService],
    };
  }
}
