import { Injectable, Logger } from '@nestjs/common';
import * as yaml from 'js-yaml';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as Joi from 'joi';

@Injectable()
export class ConfigService {
  private readonly config: AppConfig;

  constructor(private readonly logger: Logger) {
    const configPath = this.getConfigPath();
    const rawConfig: any = this.loadConfig(configPath);

    // Handle GitLab token for monitoring config sources
    if (rawConfig?.monitoringConfigSources) {
      for (const source of rawConfig.monitoringConfigSources) {
        if (!source.authToken && !process.env.GITLAB_TOKEN) {
          throw new Error('Missing GitLab token: set GITLAB_TOKEN env var or provide it in config.');
        }
        source.authToken = process.env.GITLAB_TOKEN ?? source.authToken;
      }
    }

    // Handle PostgreSQL password from environment variable
    if (rawConfig?.database) {
      if (!rawConfig.database.password && !process.env.POSTGRES_PASSWORD) {
        throw new Error('Missing PostgreSQL password: set POSTGRES_PASSWORD env var or provide it in config.');
      }

      rawConfig.database.password = process.env.POSTGRES_PASSWORD ?? rawConfig.database.password;
    }

    this.config = this.validateConfig(rawConfig);

    // Log configuration with sensitive data masked
    this.logger.debug(
      `Configuration: ${JSON.stringify(
        {
          ...this.config,
          database: {
            ...this.config.database,
            password: this.config.database.password ? '***' : undefined,
          },
          monitoringConfigSources: this.config.monitoringConfigSources?.map(source => ({
            ...source,
            authToken: source.authToken ? '***' : undefined,
          })),
        },
        null,
        2,
      )}`,
    );
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
        password: Joi.string().optional(),
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
      crons: Joi.object({
        escalations: Joi.string().optional(),
        retries: Joi.string().optional(),
        refreshConfig: Joi.string().optional(),
        autoResolve: Joi.string().optional(),
      }).optional(),
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

  getCronsConfig() {
    return this.config.crons || {};
  }
}

interface AppConfig {
  environment: string;
  database: {
    host: string;
    port: number;
    username: string;
    password?: string;
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
  crons?: {
    escalations?: string;
    retries?: string;
    refreshConfig?: string;
    autoResolve?: string;
  };
}
