import { Injectable, Logger } from '@nestjs/common';
import * as yaml from 'js-yaml';
import * as fs from 'fs';
import * as path from 'path';
import * as Joi from 'joi';
import { Chain, MonitoringGroup, WatcherType } from '@w3f/monitoring-types';
import { ConfigFetcher } from '@w3f/monitoring-config';

@Injectable()
export class ConfigService {
  private readonly config: Config;
  private monitoringGroups: MonitoringGroup[] | null = null;
  private readonly configsDir = path.join(process.cwd(), 'monitoring-configs');

  constructor(private readonly logger: Logger) {
    const configPath = this.getConfigPath();
    const rawConfig = this.loadConfig(configPath);
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
      throw new Error('Monitoring configuration initialization failed.');
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
    const chainConfigSchema = Joi.object({
      rpcs: Joi.array().items(Joi.string().uri()).min(1).required(),
      start_block: Joi.number().integer().min(1).optional(),
    });

    const telemetryConfigSchema = Joi.object({
      endpoint: Joi.string().uri().required(),
      basicAuth: Joi.object({
        username: Joi.string().required(),
        password: Joi.string().required(),
      }).optional(),
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
      monitoring_config_sources: Joi.array()
        .items(
          Joi.object({
            name: Joi.string().required(),
            url: Joi.string().uri().required(),
            auth_token: Joi.string().optional(),
          }),
        )
        .required(),
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

  getMonitoringGroups(chain: Chain): MonitoringGroup[] {
    if (this.monitoringGroups === null) {
      throw new Error('Monitoring configurations have not been initialized');
    }
    return this.monitoringGroups.filter(group => group.chain.includes(chain));
  }

  getTelemetryConfig(): TelemetryConfig | null {
    return this.config.telemetryConfig || null;
  }

  getWatcherType(): WatcherType {
    return this.config.watcherType;
  }
}

interface ChainConfig {
  rpcs: string[];
  start_block?: number;
}

interface Config {
  chain: Chain;
  watcherType: WatcherType;
  environment: string;
  redis: {
    url: string;
  };
  monitoring_config_sources: {
    name: string;
    url: string;
    auth_token?: string;
  }[];
  logging?: {
    level: string;
  };
  chainConfig?: ChainConfig;
  telemetryConfig?: TelemetryConfig;
}

interface TelemetryConfig {
  endpoint: string;
  basicAuth?: {
    username: string;
    password?: string;
  };
}
