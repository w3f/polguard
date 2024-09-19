import { Injectable } from '@nestjs/common';
import { MonitoringGroup } from '../../core/interfaces';
import { AppConfigService } from './app-config.service';
import { MonitoringConfigService } from './monitoring-config.service';
import { Chain } from '@core/constants';

@Injectable()
export class ConfigService {

  constructor(
    private appConfig: AppConfigService,
    private monitoringConfig: MonitoringConfigService,
  ) {}

  // Proxy methods for AppConfigService
  getDatabaseUrl(): string {
    return this.appConfig.getDatabaseUrl();
  }

  getChain(): Chain {
    return this.appConfig.getChain();
  }

  getRPCs(): string[] {
    return this.appConfig.getRPCs();
  }

  getEnvironment(): string {
    return this.appConfig.getEnvironment();
  }

  getRabbitMQConfig(): { url: string; queue: string } {
    return this.appConfig.getRabbitMQConfig();
  }

// Proxy methods for MonitoringConfigService
  getMonitoringGroups(chain: Chain): MonitoringGroup[] {
    return this.monitoringConfig.getMonitoringGroups(chain);
  }
}