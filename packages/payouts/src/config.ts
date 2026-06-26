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
    gracePeriodEras: Joi.number().integer().min(0).default(16),
  }).default({ gracePeriodEras: 16 }),
  notifications: Joi.object({
    matrix: Joi.object({
      url: Joi.string().uri().required(),
    }).optional(),
  }).default({}),
});

function masked(config: PayoutsConfig): PayoutsConfig {
  return {
    ...config,
    signers: Object.fromEntries(Object.keys(config.signers).map(name => [name, '***'])),
  };
}

export function loadConfig(
  logger: AppLogger,
  configPath: string = process.env.PAYOUTS_CONFIG ?? path.join(process.cwd(), 'config/config.yaml'),
): PayoutsConfig {
  if (!fs.existsSync(configPath)) {
    throw new Error(`Configuration file not found: ${configPath}`);
  }

  const raw = yaml.load(fs.readFileSync(configPath, 'utf8'));
  const { error, value } = schema.validate(raw, { abortEarly: false });
  if (error) {
    throw new Error(`Configuration validation failed: ${error.message}`);
  }

  const config = value as PayoutsConfig;
  logger.debug(`Configuration: ${JSON.stringify(masked(config), null, 2)}`);
  return config;
}
