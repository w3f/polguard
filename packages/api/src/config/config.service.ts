import { Injectable } from '@nestjs/common';
import * as yaml from 'js-yaml';
import * as fs from 'fs';
import * as path from 'path';
import * as Joi from 'joi';

@Injectable()
export class ConfigService {
  private readonly config: AppConfig;

  constructor() {
    const configPath = this.getConfigPath();
    const rawConfig: any = this.loadConfig(configPath);
    if (!rawConfig?.matrix?.password && process.env.MATRIX_PASSWORD) {
      rawConfig.matrix.password = process.env.MATRIX_PASSWORD;
    }
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
      environment: Joi.string().valid('development', 'production', 'test', 'staging').required(),
      database: Joi.object({
        host: Joi.string().required(),
        port: Joi.number().default(5432),
        username: Joi.string().required(),
        password: Joi.string().required(),
        database: Joi.string().required(),
      }).required(),
      httpServer: Joi.object({
        port: Joi.number().default(3000),
        host: Joi.string().default('0.0.0.0'),
      }).optional(),
      notificationApi: Joi.object({
        matrix: Joi.object({
          url: Joi.string().uri().required(),
        }).required(),
      }).required(),
      logging: Joi.object({
        level: Joi.string().valid('error', 'warn', 'info', 'debug', 'verbose').default('info'),
      }).optional(),
      monitoringConfigSources: Joi.array()
        .items(
          Joi.object({
            name: Joi.string().required(),
            url: Joi.string().uri().required(),
            authToken: Joi.string().optional(),
          }),
        )
        .optional(),
    });

    const { error, value } = schema.validate(config, { abortEarly: false });
    if (error) {
      throw new Error(`Configuration validation failed: ${error.message}`);
    }

    return value;
  }

  getDatabaseConfig() {
    return this.config.database;
  }

  getServerConfig() {
    return this.config.httpServer || { port: 3000, host: '0.0.0.0' };
  }

  getNotificationConfig() {
    return this.config.notificationApi;
  }

  getLoggingLevel(): string {
    return this.config.logging?.level || 'info';
  }

  getEnvironment(): string {
    return this.config.environment;
  }

  getMonitoringConfigSources() {
    return this.config.monitoringConfigSources || [];
  }
}

interface AppConfig {
  environment: string;
  database: {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
  };
  httpServer?: {
    port: number;
    host: string;
  };
  notificationApi: {
    matrix: {
      url: string;
    };
  };
  logging?: {
    level: string;
  };
  monitoringConfigSources?: {
    name: string;
    url: string;
    authToken?: string;
  }[];
}
