import { Injectable, Logger } from '@nestjs/common';
import * as yaml from 'js-yaml';
import * as fs from 'fs';
import * as path from 'path';
import * as Joi from 'joi';
import { Chain } from '@w3f/monitoring-types';

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
    const schema = Joi.object({
      chain: Joi.string()
        .valid(...Object.values(Chain))
        .required(),
      rpc: Joi.object({
        url: Joi.string().uri().required(),
      }).required(),
      startBlock: Joi.number().integer().min(0).optional(),
      environment: Joi.string().valid('development', 'production', 'test', 'staging').required(),
      redis: Joi.object({
        url: Joi.string().uri().required(),
      }).required(),
      monitoringGroupIds: Joi.array().items(Joi.string()).required(),
      logging: Joi.object({
        level: Joi.string().valid('error', 'warn', 'info', 'debug', 'verbose').default('info'),
      }).optional(),
      monitoringApi: Joi.object({
        baseUrl: Joi.string().uri().required(),
        endpoints: Joi.object({
          createIncident: Joi.string().required(),
          resolveIncident: Joi.string().required(),
          getConfig: Joi.string().required(),
        }).required(),
      }).required(),
      httpServer: Joi.object({
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

  getRpcUrl(): string {
    return this.config.rpc.url;
  }

  getStartBlock(): number {
    return this.config.startBlock;
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

  getMonitoringApi(): {
    baseUrl: string;
    endpoints: {
      createIncident: string;
      resolveIncident: string;
      getConfig: string;
    };
  } {
    return this.config.monitoringApi;
  }

  getServerConfig(): { host: string; port: number } {
    return this.config.httpServer || { host: '0.0.0.0', port: 3000 };
  }
}

interface Config {
  chain: Chain;
  rpc: {
    url: string;
  };
  startBlock?: number;
  redis: {
    url: string;
  };
  monitoringGroupIds: string[];
  monitoringApi: {
    baseUrl: string;
    endpoints: {
      createIncident: string;
      resolveIncident: string;
      getConfig: string;
    };
  };
  httpServer?: {
    port: number;
    host: string;
  };
  environment: string;
  logging?: {
    level: string;
  };
}
