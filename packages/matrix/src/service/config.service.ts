import type { AppLogger } from '@w3f/polguard-common';
import yaml from 'js-yaml';
import * as fs from 'node:fs';
import * as path from 'node:path';
import Joi from 'joi';
import { MatrixConfig } from '../lib/interfaces';

export class ConfigService {
  private readonly config: AppConfig;

  constructor(private readonly logger: AppLogger) {
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
      environment: Joi.string().valid('development', 'production', 'test', 'staging').default('development'),
      matrix: Joi.object({
        url: Joi.string().uri().required(),
        userId: Joi.string().required(),
        storageDir: Joi.string().default('data/local-storage'),
        logging: Joi.object({
          level: Joi.string().valid('trace', 'debug', 'info', 'warn', 'error').default('warn'),
        }).default({ level: 'warn' }),
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
      incidents: Joi.object({
        url: Joi.string().uri().required(),
      }).required(),
      server: Joi.object({
        port: Joi.number().default(3000),
        host: Joi.string().default('0.0.0.0'),
      }).default({ port: 3000, host: '0.0.0.0' }),
      logging: Joi.object({
        level: Joi.string().valid('error', 'warn', 'info', 'debug', 'trace').default('debug'),
      }).default({ level: 'debug' }),
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

  getIncidentsUrl(): string {
    return this.config.incidents.url;
  }

  getLoggingLevel(): string {
    return this.config.logging.level;
  }

  getServerConfig() {
    return this.config.server;
  }

  getMatrixStorageDir(): string {
    return this.config.matrix.storageDir;
  }
}

interface AppConfig {
  environment: string;
  matrix: MatrixConfig;
  incidents: {
    url: string;
  };
  server: {
    port: number;
    host: string;
  };
  logging: {
    level: string;
  };
}
