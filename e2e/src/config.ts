import yaml from 'js-yaml';
import fs from 'fs';
import path from 'path';
import Joi from 'joi';

export interface E2EConfig {
  timeoutSeconds?: number;
  api: {
    url: string;
    incident: {
      handlerType: string;
    };
  };
  chain: {
    url: string;
    targetBlock: number;
  };
  matrix: {
    homeserver: string;
    roomId: string;
    userId: string;
    tokenAuth: {
      deviceId: string;
      accessToken?: string;
    };
    messagePattern: string;
  };
}

export class ConfigService {
  private readonly config: E2EConfig;

  constructor() {
    const configPath = this.getConfigPath();
    const rawConfig: any = this.loadConfig(configPath);
    if (!rawConfig.matrix?.tokenAuth?.accessToken && !process.env.MATRIX_TOKEN) {
      throw new Error(
        "Missing Matrix access token: set MATRIX_TOKEN env var or provide it in config."
      );
    }

    // Set accessToken from env var if available, otherwise use config value
    if (rawConfig.matrix?.tokenAuth) {
      rawConfig.matrix.tokenAuth.accessToken =
        process.env.MATRIX_TOKEN ?? rawConfig.matrix.tokenAuth.accessToken;
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

  private validateConfig(config: any): E2EConfig {
    const schema = Joi.object({
      timeoutSeconds: Joi.number().default(120),
      api: Joi.object({
        url: Joi.string().required(),
        incident: Joi.object({
          handlerType: Joi.string().required(),
        }).required(),
      }).required(),
      chain: Joi.object({
        url: Joi.string().required(),
        targetBlock: Joi.number().required(),
      }).required(),
      matrix: Joi.object({
        homeserver: Joi.string().required(),
        roomId: Joi.string().required(),
        userId: Joi.string().required(),
        tokenAuth: Joi.object({
          deviceId: Joi.string().required(),
          accessToken: Joi.string().required(),
        }).required(),
        messageLimit: Joi.number().default(20),
        messagePattern: Joi.string().required(),
      }).required(),
    });

    const { error, value } = schema.validate(config, { abortEarly: false });
    if (error) {
      throw new Error(`Configuration validation failed: ${error.message}`);
    }

    return value;
  }

  getConfig(): E2EConfig {
    return this.config;
  }
}
