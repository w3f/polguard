import { Injectable } from '@nestjs/common';
import { AlertSettings, MonitoringGroup } from '../../core/interfaces';
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
  getChain(): Chain {
    return this.appConfig.getChain();
  }

  getRPCs(): string[] {
    return this.appConfig.getRPCs();
  }

  getEnvironment(): string {
    return this.appConfig.getEnvironment();
  }

  getAppFailureAlertSettings(): AlertSettings {
    return this.appConfig.getAppFailureAlertSettings();
  }

  getRedisConfig():  { host: string, port: number, db: number } {
    return this.appConfig.getRedisConfig();
  }

// Proxy methods for MonitoringConfigService
  getMonitoringGroups(chain: Chain): MonitoringGroup[] {
    return this.monitoringConfig.getMonitoringGroups(chain);
  }
}