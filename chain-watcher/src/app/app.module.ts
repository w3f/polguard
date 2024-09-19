import { Logger, Module, OnModuleInit } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ProcessedBlockModule } from './block-tracker/block-tracker.module';
import { AppService } from './app.service';
import { AppConfigService } from './config-services/app-config.service';
import { MonitoringConfigService } from './config-services/monitoring-config.service';
import { ConfigService } from './config-services/config.service';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    ProcessedBlockModule,
  ],
  providers: [
    Logger,
    AppService,
    AppConfigService,
    MonitoringConfigService,
    ConfigService,
  ],
})
export class AppModule implements OnModuleInit {
  constructor(private monitoringConfigService: MonitoringConfigService) {}

  async onModuleInit() {
    await this.monitoringConfigService.initialize();
  }
}