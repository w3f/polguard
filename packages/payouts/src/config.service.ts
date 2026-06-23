import type { AppLogger } from '@w3f/polguard-common';
import { Chain } from '@w3f/polguard-common';
import yaml from 'js-yaml';
import * as fs from 'node:fs';
import * as path from 'node:path';
import Joi from 'joi';

export interface ChainConnection {
  rpcUrl: string;
}

export interface ClaimConfig {
  batchSize: number;
  gracePeriodEras?: number;
}

export interface NotificationsConfig {
  matrix?: {
    url: string;
  };
}

export interface PayoutsConfig {
  environment: string;
  logging: {
    level: string;
  };
  payoutConfigsDir: string;
  chains: Partial<Record<Chain, ChainConnection>>;
  signers: Record<string, string>;
  claim: ClaimConfig;
  notifications: NotificationsConfig;
}

export class ConfigService {
  private readonly config: PayoutsConfig;

  constructor(private readonly logger: AppLogger) {
    const configPath = this.getConfigPath();
    const rawConfig = this.loadConfig(configPath);
    this.config = this.validateConfig(rawConfig);

    this.logger.debug(`Configuration: ${JSON.stringify(this.maskedConfig(), null, 2)}`);
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

  private validateConfig(config: unknown): PayoutsConfig {
    const schema = Joi.object({
      environment: Joi.string().valid('development', 'production', 'test', 'staging').default('development'),
      logging: Joi.object({
        level: Joi.string().valid('error', 'warn', 'info', 'debug', 'trace').default('info'),
      }).default({ level: 'info' }),
      payoutConfigsDir: Joi.string().required(),
      chains: Joi.object()
        .pattern(
          Joi.string().valid(...Object.values(Chain)),
          Joi.object({
            rpcUrl: Joi.string().uri({ scheme: ['ws', 'wss'] }).required(),
          }),
        )
        .required()
        .min(1),
      signers: Joi.object().pattern(Joi.string(), Joi.string()).required().min(1),
      claim: Joi.object({
        batchSize: Joi.number().integer().min(1).default(2),
        gracePeriodEras: Joi.number().integer().min(0).optional(),
      }).default({ batchSize: 2 }),
      notifications: Joi.object({
        matrix: Joi.object({
          url: Joi.string().uri().required(),
        }).optional(),
      }).default({}),
    });

    const { error, value } = schema.validate(config, { abortEarly: false });
    if (error) {
      throw new Error(`Configuration validation failed: ${error.message}`);
    }

    return value;
  }

  /** Config with signer secrets redacted, for logging. */
  private maskedConfig(): PayoutsConfig {
    return {
      ...this.config,
      signers: Object.fromEntries(Object.keys(this.config.signers).map(name => [name, '***'])),
    };
  }

  getEnvironment(): string {
    return this.config.environment;
  }

  getLoggingLevel(): string {
    return this.config.logging.level;
  }

  getPayoutConfigsDir(): string {
    return this.config.payoutConfigsDir;
  }

  getChains(): Partial<Record<Chain, ChainConnection>> {
    return this.config.chains;
  }

  getSigners(): Record<string, string> {
    return this.config.signers;
  }

  getClaimConfig(): ClaimConfig {
    return this.config.claim;
  }

  getNotificationsConfig(): NotificationsConfig {
    return this.config.notifications;
  }
}
