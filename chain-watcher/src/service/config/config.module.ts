import { Module, Logger } from '@nestjs/common';
import { AppConfigService } from './app-config.service';
import { MonitoringConfigService } from './monitoring-config.service';
import { ConfigService } from './config.service';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [HttpModule],
  providers: [
    Logger,
    AppConfigService,
    MonitoringConfigService,
    {
      provide: ConfigService,
      useFactory: async (monitoringConfigService: MonitoringConfigService, appConfigService: AppConfigService) => {
        await monitoringConfigService.initialize();
        return new ConfigService(appConfigService, monitoringConfigService);
      },
      inject: [MonitoringConfigService, AppConfigService],
    },
  ],
  exports: [ConfigService],
})
export class ConfigModule {}
