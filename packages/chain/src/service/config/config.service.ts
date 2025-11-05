import { Injectable, Logger } from '@nestjs/common';
import * as yaml from 'js-yaml';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as Joi from 'joi';
import { Chain } from '@w3f/monitoring-types';

type StoreType = 'inMemory' | 'service' | 'file';

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
      throw new Error(`Configuration file not found: ${configPath}`);
    }
    return yaml.load(fs.readFileSync(configPath, 'utf8'));
  }

  private validateConfig(config: unknown): Config {
    const schema = Joi.object({
      chain: Joi.string()
        .valid(...Object.values(Chain))
        .required(),
      rpc: Joi.object({
        url: Joi.string().uri().required(),
      }).required(),
      startBlock: Joi.number().integer().min(0).optional(),
      environment: Joi.string().valid('development', 'production', 'test', 'staging').required(),
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
      store: Joi.object({
        type: Joi.string().valid('inMemory', 'service', 'file').default('inMemory'),
        filePath: Joi.string().when('type', {
          is: 'file',
          then: Joi.string().default('data/chain-store.json'),
          otherwise: Joi.string().optional(),
        }),
        baseUrl: Joi.string().uri().when('type', {
          is: 'service',
          then: Joi.required(),
          otherwise: Joi.optional(),
        }),
        endpoints: Joi.object({
          getLastBlock: Joi.string().required(),
          setLastBlock: Joi.string().required(),
        }).when('type', {
          is: 'service',
          then: Joi.required(),
          otherwise: Joi.optional(),
        }),
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

  getRpcUrl(): string {
    return this.config.rpc.url;
  }

  getStartBlock(): number {
    return this.config.startBlock;
  }

  getEnvironment(): string {
    return this.config.environment;
  }

  getLoggingLevel(): string {
    return this.config.logging?.level || 'info';
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

  getServerConfig(): { host: string; port: number } {
    return this.config.httpServer || { host: '0.0.0.0', port: 3000 };
  }

  getStorageDataPath(): string {
    return this.config.storage?.dataPath || 'data/node-persist';
  }

  getStoreType(): StoreType {
    return this.config?.store?.type ?? 'inMemory';
  }

  getStoreConfig(): {
    type: StoreType;
    filePath?: string;
    baseUrl?: string;
    endpoints?: {
      getLastBlock: string;
      setLastBlock: string;
    };
  } {
    return {
      type: this.config?.store?.type ?? 'inMemory',
      filePath: this.config?.store?.filePath,
      baseUrl: this.config?.store?.baseUrl,
      endpoints: this.config?.store?.endpoints,
    };
  }
}

interface Config {
  chain: Chain;
  rpc: {
    url: string;
  };
  startBlock?: number;
  monitoringApi: {
    baseUrl: string;
    endpoints: {
      createIncident: string;
      resolveIncident: string;
      getConfig: string;
      getLastBlock: string;
      setLastBlock: string;
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
  storage?: {
    dataPath: string;
  };
  store?: {
    type: StoreType;
    filePath?: string;
    baseUrl?: string;
    endpoints?: {
      getLastBlock: string;
      setLastBlock: string;
    };
  };
}
