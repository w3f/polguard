import { Module, DynamicModule } from '@nestjs/common';
import { HttpModule, HttpService } from '@nestjs/axios';
import { TelemetryService } from './telemetry.service';
import { ConfigModule } from '../config/config.module';
import { ConfigService } from '../config/config.service';

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
            return new TelemetryService(httpService, configService);
          },
          inject: [ConfigService, HttpService],
        },
      ],
      exports: [TelemetryService],
    };
  }
}
