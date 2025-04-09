import { Module, DynamicModule, Logger } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { IncidentApiService } from './incident-publisher.service';
import { ConfigModule } from '../config/config.module';

@Module({})
export class IncidentModule {
  static forRootAsync(): DynamicModule {
    return {
      module: IncidentModule,
      imports: [ConfigModule, HttpModule],
      providers: [Logger, IncidentApiService],
      exports: [IncidentApiService],
    };
  }
}
