import { Module, DynamicModule } from '@nestjs/common';
import { HttpModule, HttpService } from '@nestjs/axios';
import { TelemetryService } from './telemetry.service';
import { ConfigModule } from '../config/config.module';
import { ConfigService } from '../config/config.service';
import { WatcherType } from '@w3f/monitoring-types';

@Module({})
export class TelemetryModule {
  static forRootAsync(): DynamicModule {
    return {
      module: TelemetryModule,
      imports: [HttpModule, ConfigModule],
      providers: [
        {
          provide: TelemetryService,
          useFactory: (configService: ConfigService, httpService: HttpService) => {
            if (configService.getWatcherType() === WatcherType.Chain) {
              return null;
            }
            return new TelemetryService(httpService, configService);
          },
          inject: [ConfigService, HttpService],
        },
      ],
      exports: [TelemetryService],
    };
  }
}
