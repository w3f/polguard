import { Injectable, Logger } from '@nestjs/common';
import * as yaml from 'js-yaml';
import * as fs from 'fs';
import * as path from 'path';
import * as Joi from 'joi';
import { Chain } from '@core/constants';

@Injectable()
export class AppConfigService {
  private readonly config: AppConfig;

  constructor(private readonly logger: Logger) {
    const configPath = this.getConfigPath();
    try {
      const rawConfig = this.loadConfig(configPath);
      this.config = this.validateConfig(rawConfig);
    } catch (error) {
      this.logger.error(`Failed to load or validate configuration: ${error.message}`);
      throw error;
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

  private validateConfig(config: unknown): AppConfig {
    const schema = Joi.object({
      database: Joi.object({
        url: Joi.string().uri().required()
      }).required(),
      chain: Joi.object({
        name: Joi.string().valid(...Object.values(Chain)).required(),
        rpcs: Joi.array().items(Joi.string().uri()).min(1).required()
      }).required(),
      environment: Joi.string().valid('development', 'production', 'test').required(),
      rabbitmq: Joi.object({
        url: Joi.string().uri().required(),
        queue: Joi.string().required()
      }).required(),
      monitoring_config_sources: Joi.array().items(Joi.object({
        name: Joi.string().required(),
        url: Joi.string().uri().required(),
        branch: Joi.string().required(),
        auth_token: Joi.string().optional()
      })).min(1).required(),
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

  getDatabaseUrl(): string {
    return this.config.database.url;
  }

  getChain(): Chain {
    return this.config.chain.name;
  }

  getRPCs(): string[] {
    return this.config.chain.rpcs;
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
  database: {
    url: string;
  };
  chain: {
    name: Chain;
    rpcs: string[];
  };
  environment: string;
  rabbitmq: {
    url: string;
    queue: string;
  };
  monitoring_config_sources: MonitoringConfigSource[];
  logging?: {
    level: string;
  };
}
