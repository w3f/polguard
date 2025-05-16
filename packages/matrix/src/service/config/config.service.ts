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

    // Handle env vars
    if (rawConfig?.matrix?.passwordAuth && !rawConfig.matrix.passwordAuth.password) {
      rawConfig.matrix.passwordAuth.password = process.env.MATRIX_PASSWORD;
    }
    if (rawConfig?.matrix?.tokenAuth && !rawConfig.matrix.tokenAuth.accessToken && process.env.MATRIX_TOKEN) {
      rawConfig.matrix.tokenAuth.accessToken = process.env.MATRIX_TOKEN;
    }

    // Set default enableEncryption depending on the auth
    if (rawConfig?.matrix?.tokenAuth) {
      rawConfig.matrix.enableEncryption = false;
    } else if (rawConfig?.matrix?.passwordAuth) {
      rawConfig.matrix.enableEncryption = true;
    }

    this.config = this.validateConfig(rawConfig);

    // Log masked config
    const maskedConfig = JSON.parse(JSON.stringify(this.config));
    if (maskedConfig.matrix.passwordAuth) {
      maskedConfig.matrix.passwordAuth.password = '***';
    }
    if (maskedConfig.matrix.tokenAuth) {
      maskedConfig.matrix.tokenAuth.accessToken = '***';
    }
    this.logger.debug(`Configuration: ${JSON.stringify(maskedConfig, null, 2)}`);
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
        userId: Joi.string().required(),
        logging: Joi.object({
          level: Joi.string().valid('trace', 'debug', 'info', 'warn', 'error'),
        }).default({ level: 'warn' }),
        rooms: Joi.array()
          .items(
            Joi.object({
              id: Joi.string()
                .pattern(/^[!#][A-Za-z0-9\._\-]+:[A-Za-z0-9\.\-]+$/)
                .required(),
              acknowledgement: Joi.boolean().default(false).optional(),
            }),
          )
          .required(),
        enableEncryption: Joi.boolean().optional(),
        passwordAuth: Joi.object({
          password: Joi.string().required().messages({
            'any.required':
              'Matrix password is required. Provide it in the config file or set the MATRIX_PASSWORD environment variable.',
          }),
        }).optional(),
        tokenAuth: Joi.object({
          accessToken: Joi.string().required(),
          deviceId: Joi.string().required(),
        }).optional(),
      })
        .required()
        .xor('passwordAuth', 'tokenAuth')
        .messages({
          'object.xor': 'Either passwordAuth or tokenAuth must be provided, but not both.',
        })
        .custom((value, helpers) => {
          if (value.tokenAuth && value.enableEncryption !== false) {
            return helpers.error('any.invalid', {
              message: 'When using tokenAuth, enableEncryption must be set to false',
            });
          }
          return value;
        }),
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
