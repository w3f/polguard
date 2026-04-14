import { Injectable, Logger } from '@nestjs/common';
import * as yaml from 'js-yaml';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as Joi from 'joi';
import { Chain } from '../../types';

type StoreType = 'inMemory' | 'service' | 'file';
interface StoreConfig {
  type: StoreType;
  file?: {
    path: string;
  };
  service?: {
    url: string;
  };
}

type IncidentReporterType = 'stdout' | 'service' | 'webhook';
interface IncidentReporterConfig {
  type: IncidentReporterType;
  stdout?: {
    format: 'json' | 'pretty';
  };
  service?: {
    url: string;
  };
  webhook?: {
    url: string;
    headers?: Record<string, string>;
  };
}

@Injectable()
export class ConfigService {
  private readonly config: Config;

  constructor(private readonly logger: Logger) {
    const configPath = this.getConfigPath();
    const rawConfig = this.loadConfig(configPath);
    this.config = this.validateConfig(rawConfig);

    this.logger.debug(`Configuration: ${JSON.stringify(this.config, null, 2)}`);
  }

  private getConfigPath(): string {
    return path.join(process.cwd(), 'config/config.yaml');
  }

  private loadConfig(configPath: string): unknown {
    if (!fs.existsSync(configPath)) {
      // Use default values only (development)
      return {};
    }
    return yaml.load(fs.readFileSync(configPath, 'utf8'));
  }

  private validateConfig(config: unknown): Config {
    const schema = Joi.object({
      chain: Joi.object({
        name: Joi.string()
          .valid(...Object.values(Chain))
          .default(Chain.AssetHubPolkadot),
        rpcUrl: Joi.string().uri().default('wss://polkadot-asset-hub-rpc.polkadot.io'),
        startBlock: Joi.number().integer().min(0).optional(),
      }).default({
        name: Chain.AssetHubPolkadot,
        rpcUrl: 'wss://polkadot-asset-hub-rpc.polkadot.io',
      }),
      environment: Joi.string().valid('development', 'production', 'test', 'staging').default('development'),
      logging: Joi.object({
        level: Joi.string().valid('error', 'warn', 'info', 'debug', 'verbose').default('debug'),
      }).default({ level: 'debug' }),
      server: Joi.object({
        port: Joi.number().default(3000),
        host: Joi.string().default('0.0.0.0'),
      }).default({ port: 3000, host: '0.0.0.0' }),
      store: Joi.object({
        type: Joi.string().valid('inMemory', 'service', 'file').required(),
        file: Joi.object({
          path: Joi.string().required(),
        })
          .when('type', {
            is: 'file',
            then: Joi.required(),
            otherwise: Joi.forbidden(),
          })
          .default({ path: './data/chain-store.json' }),
        service: Joi.object({
          url: Joi.string().uri().required(),
        }).when('type', {
          is: 'service',
          then: Joi.required(),
          otherwise: Joi.forbidden(),
        }),
      }).default({ type: 'inMemory' }),
      incidentReporter: Joi.object({
        type: Joi.string().valid('stdout', 'service', 'webhook').required(),
        stdout: Joi.object({
          format: Joi.string().valid('json', 'pretty').default('pretty'),
        }).when('type', {
          is: 'stdout',
          then: Joi.optional(),
          otherwise: Joi.forbidden(),
        }),
        service: Joi.object({
          url: Joi.string().uri().required(),
        }).when('type', {
          is: 'service',
          then: Joi.required(),
          otherwise: Joi.forbidden(),
        }),
        webhook: Joi.object({
          url: Joi.string().uri().required(),
          headers: Joi.object().pattern(Joi.string(), Joi.string()).optional(),
        }).when('type', {
          is: 'webhook',
          then: Joi.required(),
          otherwise: Joi.forbidden(),
        }),
      }).default({ type: 'stdout', stdout: { format: 'pretty' } }),
      monitoringConfigsDir: Joi.string().default('../config/examples'),
    });

    const { error, value } = schema.validate(config, { abortEarly: false });
    if (error) {
      throw new Error(`Configuration validation failed: ${error.message}`);
    }

    return value;
  }

  getChain(): Chain {
    return this.config.chain.name;
  }

  getRpcUrl(): string {
    return this.config.chain.rpcUrl;
  }

  getStartBlock(): number | undefined {
    return this.config.chain.startBlock;
  }

  getEnvironment(): string {
    return this.config.environment;
  }

  getLoggingLevel(): string {
    return this.config.logging.level;
  }

  getServerConfig(): { host: string; port: number } {
    return this.config.server;
  }

  getStoreConfig(): StoreConfig {
    return this.config.store;
  }

  getIncidentReporterConfig(): IncidentReporterConfig {
    return this.config.incidentReporter;
  }

  getMonitoringConfigsDir(): string {
    return this.config.monitoringConfigsDir;
  }
}

interface Config {
  chain: {
    name: Chain;
    rpcUrl: string;
    startBlock?: number;
  };
  server: {
    port: number;
    host: string;
  };
  environment: string;
  logging: {
    level: string;
  };
  store: StoreConfig;
  incidentReporter: IncidentReporterConfig;
  monitoringConfigsDir: string;
}
