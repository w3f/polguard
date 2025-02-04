import { Injectable, Logger } from '@nestjs/common';
import * as yaml from 'js-yaml';
import * as fs from 'fs';
import * as path from 'path';
import * as Joi from 'joi';
import { MonitoringGroup } from '@w3f/monitoring-types';
import { ConfigFetcher } from '@w3f/monitoring-config';

interface Config {
  environment: string;
  redis: {
    url: string;
  };
  monitoring_config_sources: {
    name: string;
    url: string;
    auth_token?: string;
  }[];
  ipinfo: {
    token?: string;
    cache_ttl: number;
  };
  logging?: {
    level: string;
  };
}

@Injectable()
export class ConfigService {
  private readonly config: Config;
  private monitoringGroups: MonitoringGroup[] = [];
  private readonly configsDir = path.join(process.cwd(), 'monitoring-configs');

  constructor(private readonly logger: Logger) {
    const configPath = this.getConfigPath();
    const rawConfig: any = this.loadConfig(configPath);
    if (!rawConfig?.ipinfo?.token && process.env.IPINFO_TOKEN) {
      rawConfig.ipinfo.token = process.env.IPINFO_TOKEN;
    }
    this.config = this.validateConfig(rawConfig);
  }

  async initialize(): Promise<void> {
    try {
      this.monitoringGroups = await ConfigFetcher.fetchAndProcessConfigs(
        this.config.monitoring_config_sources,
        this.configsDir,
      );
      this.logger.log(`Loaded ${this.monitoringGroups.length} monitoring groups`);
    } catch (error) {
      this.logger.error('Failed to initialize monitoring configuration:', error);
      throw new Error('Monitoring configuration initialization failed: ' + error.message);
    }
  }

  private getConfigPath(): string {
    return path.join(process.cwd(), 'config/config.yaml');
  }

  private loadConfig(configPath: string): unknown {
    if (!fs.existsSync(configPath)) {
      throw new Error(`Configuration file not found: ${configPath}`);
    }
    return yaml.load(fs.readFileSync(configPath, 'utf8'));
  }

  private validateConfig(config: unknown): Config {
    const schema = Joi.object({
      environment: Joi.string().valid('development', 'production', 'test', 'staging').required(),
      redis: Joi.object({
        url: Joi.string().uri().required(),
      }).required(),
      monitoring_config_sources: Joi.array()
        .items(
          Joi.object({
            name: Joi.string().required(),
            url: Joi.string().uri().required(),
            auth_token: Joi.string().optional(),
          }),
        )
        .required(),
      ipinfo: Joi.object({
        token: Joi.string().required().messages({
          'any.required':
            'IPInfo token is required. Provide it in the config file or set the IPINFO_TOKEN environment variable.',
        }),
        cache_ttl: Joi.number().integer().min(1).default(43200), // 12 hours in seconds
      }).required(),
      logging: Joi.object({
        level: Joi.string().valid('error', 'warn', 'info', 'debug', 'verbose').default('info'),
      }).optional(),
    });

    const { error, value } = schema.validate(config, { abortEarly: false });
    if (error) {
      throw new Error(`Configuration validation failed: ${error.message}`);
    }

    return value;
  }

  getEnvironment(): string {
    return this.config.environment;
  }

  getRedisConfig(): { host: string; port: number; db: number } {
    const redisUrl = new URL(this.config.redis.url);
    return {
      host: redisUrl.hostname,
      port: Number(redisUrl.port) || 6379,
      db: Number(redisUrl.pathname.split('/')[1]) || 0,
    };
  }

  getIpInfoConfig(): { token: string; cacheTtl: number } {
    return {
      token: this.config.ipinfo.token,
      cacheTtl: this.config.ipinfo.cache_ttl,
    };
  }

  getLoggingLevel(): string {
    return this.config.logging?.level || 'info';
  }

  getMonitoringGroups(): MonitoringGroup[] {
    return this.monitoringGroups;
  }
}
