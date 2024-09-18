import { Injectable, Logger } from '@nestjs/common';
import * as yaml from 'js-yaml';
import * as fs from 'fs';
import * as path from 'path';
import { findProjectRoot } from '@app/utils';
import { Chain } from '@core/constants';

@Injectable()
export class AppConfigService {
  private readonly config: AppConfig;

  constructor(private readonly logger: Logger) {
    const projectRoot = findProjectRoot();
    const configPath = path.join(projectRoot, 'config.yaml');
    try {
      if (!fs.existsSync(configPath)) {
        throw new Error(`Configuration file not found: ${configPath}`);
      }
      this.config = yaml.load(fs.readFileSync(configPath, 'utf8')) as AppConfig;
      this.validateConfig();
    } catch (error) {
      this.logger.error(`Failed to load or validate configuration: ${error.message}`);
      throw error;
    }
  }

  private validateConfig() {
    const requiredKeys: (keyof AppConfig)[] = [
      'database',
      'chain',
      'environment',
      'rabbitmq',
      'monitoring_config_sources'
    ];

    for (const key of requiredKeys) {
      if (!(key in this.config)) {
        throw new Error(`Missing required configuration key: ${key}`);
      }
    }

    if (!Object.values(Chain).includes(this.config.chain)) {
      throw new Error(`Invalid chain specified: ${this.config.chain}. Valid values are: ${Object.values(Chain).join(', ')}`);
    }

    if (!Array.isArray(this.config.monitoring_config_sources) || this.config.monitoring_config_sources.length === 0) {
      throw new Error('monitoring_config_sources must be a non-empty array');
    }

    this.config.monitoring_config_sources.forEach((source, index) => {
      if (!source.name || !source.url || !source.branch) {
        throw new Error(`Invalid monitoring config source at index ${index}: missing required fields`);
      }
    });
  }

  getDatabaseUrl(): string {
    return this.config.database.url;
  }

  getChain(): Chain {
    return this.config.chain;
  }

  getEnvironment(): string {
    return this.config.environment;
  }

  getRabbitMQConfig(): { url: string; queue: string } {
    return this.config.rabbitmq;
  }

  getMonitoringConfigSources(): MonitoringConfigSource[] {
    return this.config.monitoring_config_sources;
  }
}

interface MonitoringConfigSource {
  name: string;
  url: string;
  branch: string;
  auth_token?: string;
}

interface AppConfig {
  database: {
    url: string;
  };
  chain: Chain;
  environment: string;
  rabbitmq: {
    url: string;
    queue: string;
  };
  monitoring_config_sources: MonitoringConfigSource[];
}
