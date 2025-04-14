import { Injectable, Logger } from '@nestjs/common';
import * as yaml from 'js-yaml';
import * as fs from 'fs';
import * as path from 'path';
import * as Joi from 'joi';
import { Chain, WatcherType } from '@w3f/monitoring-types';

@Injectable()
export class ConfigService {
  private readonly config: Config;

  constructor(private readonly logger: Logger) {
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

  private validateConfig(config: unknown): Config {
    const chainConfigSchema = Joi.object({
      rpcs: Joi.array().items(Joi.string().uri()).min(1).required(),
      startBlock: Joi.number().integer().min(1).optional(),
    });

    const telemetryConfigSchema = Joi.object({
      endpoint: Joi.string().uri().required(),
      basicAuth: Joi.object({
        username: Joi.string().required(),
        password: Joi.string().required(),
      }).optional(),
      interval: Joi.number()
        .integer()
        .min(1000)
        .default(30000)
        .description('Telemetry polling interval in milliseconds'),
    });

    const schema = Joi.object({
      chain: Joi.string()
        .valid(...Object.values(Chain))
        .required(),
      chainConfig: Joi.alternatives().conditional('watcherType', {
        is: WatcherType.Chain,
        then: chainConfigSchema.required(),
        otherwise: chainConfigSchema.optional(),
      }),
      environment: Joi.string().valid('development', 'production', 'test', 'staging').required(),
      redis: Joi.object({
        url: Joi.string().uri().required(),
      }).required(),
      monitoringGroupIds: Joi.array().items(Joi.string()).required(),
      logging: Joi.object({
        level: Joi.string().valid('error', 'warn', 'info', 'debug', 'verbose').default('info'),
      }).optional(),
      telemetryConfig: Joi.alternatives().conditional('watcherType', {
        is: WatcherType.Telemetry,
        then: telemetryConfigSchema.required(),
        otherwise: telemetryConfigSchema.optional(),
      }),
      watcherType: Joi.string()
        .valid(...Object.values(WatcherType))
        .required(),
      incidentManagement: Joi.object({
        urls: Joi.object({
          create: Joi.string().uri().required(),
          resolve: Joi.string().uri().required(),
        }).required(),
      }).required(),
      monitoringConfig: Joi.object({
        url: Joi.string().uri().required(),
      }).required(),
      server: Joi.object({
        port: Joi.number().default(3000),
        host: Joi.string().default('0.0.0.0'),
      }).optional(),
    });

    const { error, value } = schema.validate(config, { abortEarly: false });
    if (error) {
      throw new Error(`Configuration validation failed: ${error.message}`);
    }

    return value;
  }

  getChain(): Chain {
    return this.config.chain;
  }

  getChainConfig(): ChainConfig | null {
    return this.config.chainConfig || null;
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

  getLoggingLevel(): string {
    return this.config.logging?.level || 'info';
  }

  getMonitoringGroupIds(): string[] {
    return this.config.monitoringGroupIds;
  }

  getTelemetryConfig(): TelemetryConfig | null {
    return this.config.telemetryConfig || null;
  }

  getWatcherType(): WatcherType {
    return this.config.watcherType;
  }

  getIncidentManagementUrls(): { create: string; resolve: string } {
    return this.config.incidentManagement.urls;
  }

  getMonitoringConfigUrl(): string {
    return this.config.monitoringConfig.url;
  }

  getServerConfig(): { host: string; port: number } {
    return this.config.server || { host: '0.0.0.0', port: 3000 };
  }
}

interface ChainConfig {
  rpcs: string[];
  startBlock?: number;
}

interface Config {
  chain: Chain;
  watcherType: WatcherType;
  environment: string;
  redis: {
    url: string;
  };
  monitoringGroupIds: string[];
  logging?: {
    level: string;
  };
  chainConfig?: ChainConfig;
  telemetryConfig?: TelemetryConfig;
  incidentManagement: {
    urls: {
      create: string;
      resolve: string;
    };
  };
  monitoringConfig: {
    url: string;
  };
  server?: {
    port: number;
    host: string;
  };
}

interface TelemetryConfig {
  endpoint: string;
  basicAuth?: {
    username: string;
    password?: string;
  };
  interval: number;
}
