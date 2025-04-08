import { Module, DynamicModule } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { IncidentService } from './incident.service';
import { ConfigModule } from '../config/config.module';
import { IncidentController } from './incident.controller';
import { AppModule } from '../app.module';

@Module({})
export class IncidentModule {
  static forRootAsync(): DynamicModule {
    return {
      module: IncidentModule,
      imports: [ConfigModule, AppModule, HttpModule],
      controllers: [IncidentController],
      providers: [IncidentService],
      exports: [IncidentService],
    };
  }
}
