import { Injectable, Logger } from '@nestjs/common';
import * as yaml from 'js-yaml';
import * as fs from 'fs';
import * as path from 'path';
import * as Joi from 'joi';
import { MatrixConfig } from '@lib/interfaces';

@Injectable()
export class ConfigService {
  private readonly config: AppConfig;

  constructor(private readonly logger: Logger) {
    const configPath = this.getConfigPath();
    const rawConfig: any = this.loadConfig(configPath);
    
    if (!rawConfig?.matrix?.password && !process.env.MATRIX_PASSWORD) {
      throw new Error(
        "Missing Matrix password: set MATRIX_PASSWORD env var or provide it in config."
      );
    }
    
    rawConfig.matrix.password = 
      process.env.MATRIX_PASSWORD ?? rawConfig.matrix.password;
    
    this.config = this.validateConfig(rawConfig);
    
    // Log configuration with sensitive data masked
    this.logger.debug(`Configuration: ${JSON.stringify({
      ...this.config,
      matrix: {
        ...this.config.matrix,
        password: this.config.matrix.password ? '***' : undefined
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

  private validateConfig(config: unknown): AppConfig {
    const schema = Joi.object({
      environment: Joi.string().valid('development', 'production', 'test', 'staging').required(),
      matrix: Joi.object({
        url: Joi.string().uri().required(),
        logging: Joi.object({
          level: Joi.string().valid('trace', 'debug', 'info', 'warn', 'error'),
        }).default({ level: 'warn' }),
        userId: Joi.string().required(),
        password: Joi.string().required().messages({
          'any.required':
            'Matrix password is required. Provide it in the config file or set the MATRIX_PASSWORD environment variable.',
        }),
        rooms: Joi.array()
          .items(
            Joi.object({
              id: Joi.string()
                .pattern(/^[!#][A-Za-z0-9\._\-]+:[A-Za-z0-9\.\-]+$/)
                .required(),
              acknowledgement: Joi.boolean().default(false).optional(),
            }),
          )
          .optional(),
      }).required(),
      monitoringApi: Joi.object({
        baseUrl: Joi.string().uri().required(),
        endpoints: Joi.object({
          getIncidents: Joi.string().required(),
          getIncident: Joi.string().required(),
          acknowledgeIncident: Joi.string().required(),
        }).required(),
      }).required(),
      httpServer: Joi.object({
        port: Joi.number().default(3000),
        host: Joi.string().default('0.0.0.0'),
      }).optional(),
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

  getMatrixConfig(): MatrixConfig {
    return this.config.matrix;
  }

  getMonitoringApi(): {
    baseUrl: string;
    endpoints: {
      getIncidents: string;
      getIncident: string;
      acknowledgeIncident: string;
    };
  } {
    return this.config.monitoringApi;
  }

  getLoggingLevel(): string {
    return this.config.logging?.level || 'info';
  }

  getServerConfig() {
    return this.config.httpServer || { port: 3000, host: '0.0.0.0' };
  }
}

interface AppConfig {
  environment: string;
  matrix: MatrixConfig;
  monitoringApi: {
    baseUrl: string;
    endpoints: {
      getIncidents: string;
      getIncident: string;
      acknowledgeIncident: string;
    };
  };
  httpServer: {
    port: number;
    host: string;
  };
  logging?: {
    level: string;
  };
}
