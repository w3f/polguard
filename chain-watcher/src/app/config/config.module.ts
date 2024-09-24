import { Module, OnModuleInit } from '@nestjs/common';
import { AppConfigService } from './app-config.service';
import { MonitoringConfigService } from './monitoring-config.service';
import { ConfigService } from './config.service';

@Module({
  providers: [
    AppConfigService,
    MonitoringConfigService,
    ConfigService,
  ],
  exports: [
    AppConfigService,
    MonitoringConfigService,
    ConfigService,
  ],
})
export class ConfigModule implements OnModuleInit {
  constructor(private monitoringConfigService: MonitoringConfigService) {}

  async onModuleInit() {
    await this.monitoringConfigService.initialize();
  }
}
