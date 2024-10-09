import { Injectable, Logger } from '@nestjs/common';
import * as yaml from 'js-yaml';
import * as fs from 'fs';
import * as path from 'path';
import * as Joi from 'joi';
import { Chain } from '@lib/constants';
import { AlertSettings } from '@lib/interfaces';

@Injectable()
export class AppConfigService {
  private readonly config: AppConfig;

  constructor() {
    const configPath = this.getConfigPath();
    const rawConfig = this.loadConfig(configPath);
    this.config = this.validateConfig(rawConfig);
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

  private validateConfig(config: unknown): AppConfig {
    const schema = Joi.object({
      chain: Joi.object({
        name: Joi.string().valid(...Object.values(Chain)).required(),
        rpcs: Joi.array().items(Joi.string().uri()).min(1).required(),
        start_block: Joi.number().integer().min(1).optional(),
      }).required(),
      environment: Joi.string().valid('development', 'production', 'test').required(),
      redis: Joi.object({
        url: Joi.string().uri().required(),
      }).required(),
      monitoring_config_sources: Joi.array().items(Joi.object({
        name: Joi.string().required(),
        url: Joi.string().uri().required(),
        branch: Joi.string().required(),
        auth_token: Joi.string().optional()
      })).required(),
      alerts: Joi.object({
        matrix: Joi.object({
          targets: Joi.array().items(Joi.string().pattern(/^![A-Za-z0-9\._\-]+:[A-Za-z0-9\.\-]+$/)).min(1).required(),
          repeat_interval: Joi.number().optional(),
          acknowledgement: Joi.object({
            escalation: Joi.object({
              timeout: Joi.number().required(),
              targets: Joi.array().items(Joi.string().pattern(/^![A-Za-z0-9\._\-]+:[A-Za-z0-9\.\-]+$/)).min(1).required()
            }).optional()
          }).optional()
        }).required()
      }).required(),
      logging: Joi.object({
        level: Joi.string().valid('error', 'warn', 'info', 'debug', 'verbose').default('info')
      }).optional()
    });

    const { error, value } = schema.validate(config, { abortEarly: false });
    if (error) {
      throw new Error(`Configuration validation failed: ${error.message}`);
    }

    return value;
  }

  getChain(): Chain {
    return this.config.chain.name;
  }

  getRPCs(): string[] {
    return this.config.chain.rpcs;
  }

  getStartBlock(): number | null {
    return this.config.chain.start_block;
  }

  getEnvironment(): string {
    return this.config.environment;
  }

  getAppFailureAlertSettings(): AlertSettings {
    return this.config.alerts;
  }

  getRedisConfig(): { host: string, port: number, db: number } {
    const redisUrl = new URL(this.config.redis.url);
    return {
      host: redisUrl.hostname,
      port: Number(redisUrl.port) || 6379,
      db: Number(redisUrl.pathname.split('/')[1]) || 0,
    };
  }

  getMonitoringConfigSources(): MonitoringConfigSource[] {
    return this.config.monitoring_config_sources;
  }

  getLoggingLevel(): string {
    return this.config.logging?.level || 'info';
  }
}

interface MonitoringConfigSource {
  name: string;
  url: string;
  branch: string;
  auth_token?: string;
}

interface AppConfig {
  chain: {
    name: Chain;
    rpcs: string[];
    start_block?: number;
  };
  environment: string;
  redis: {
    url: string;
  };
  monitoring_config_sources: MonitoringConfigSource[];
  logging?: {
    level: string;
  };
  alerts: AlertSettings
}
