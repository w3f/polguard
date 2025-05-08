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
    const rawConfig: any = this.loadConfig(configPath);
    
    if (rawConfig?.telemetryExporterApi?.basicAuth) {
      if (!rawConfig.telemetryExporterApi.basicAuth.password && !process.env.TELEMETRY_PASSWORD) {
        throw new Error(
          "Missing Telemetry password: set TELEMETRY_PASSWORD env var or provide it in config."
        );
      }
      
      rawConfig.telemetryExporterApi.basicAuth.password = 
        process.env.TELEMETRY_PASSWORD ?? rawConfig.telemetryExporterApi.basicAuth.password;
    }
    
    this.config = this.validateConfig(rawConfig);
    
    // Log configuration with sensitive data masked
    this.logger.debug(`Configuration: ${JSON.stringify({
      ...this.config,
      telemetryExporterApi: {
        ...this.config.telemetryExporterApi,
        basicAuth: this.config.telemetryExporterApi.basicAuth ? {
          ...this.config.telemetryExporterApi.basicAuth,
          password: this.config.telemetryExporterApi.basicAuth.password ? '***' : undefined
        } : undefined
      }
    }, null, 2)}`);
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
      telemetryExporterApi: Joi.object({
        url: Joi.string().uri().required(),
        basicAuth: Joi.object({
          username: Joi.string().required(),
          password: Joi.string().optional(), // Password can be provided via env var
        }).optional(),
      }).required(),
      pollingIntervalMs: Joi.number()
        .integer()
        .min(1000)
        .default(30 * 60 * 1000)
        .description('Telemetry polling interval in milliseconds'),
      environment: Joi.string().valid('development', 'production', 'test', 'staging').required(),
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

  getPollingInterval(): number {
    return this.config.pollingIntervalMs;
  }

  getEnvironment(): string {
    return this.config.environment;
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

  getTelemetryExporterApi(): {
    url: string;
    basicAuth?: {
      username: string;
      password: string;
    };
  } {
    return this.config.telemetryExporterApi;
  }

  getServerConfig(): { host: string; port: number } {
    return this.config.httpServer || { host: '0.0.0.0', port: 3000 };
  }
}

interface Config {
  chain: Chain;
  pollingIntervalMs: number;
  monitoringGroupIds: string[];
  telemetryExporterApi: {
    url: string;
    basicAuth?: {
      username: string;
      password: string;
    };
  };
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
