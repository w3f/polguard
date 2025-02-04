import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Chain } from '@w3f/monitoring-types';
import Redis from 'ioredis';
import { TelemetryExporter } from '../../lib/telemetry-exporter';
import { ConfigService } from '../config/config.service';

@Injectable()
export class TelemetryService implements OnModuleDestroy {
  private exporter: TelemetryExporter;
  private redis: Redis;

  constructor(
    private readonly config: ConfigService,
    private readonly logger: Logger,
  ) {}

  async initialize(): Promise<void> {
    this.logger.debug('Initializing Redis client...');
    const redisConfig = this.config.getRedisConfig();
    this.redis = new Redis({
      host: redisConfig.host,
      port: redisConfig.port,
      db: redisConfig.db,
    });

    this.logger.debug('Creating telemetry exporter...');
    const ipinfoConfig = this.config.getIpInfoConfig();
    this.exporter = new TelemetryExporter(
      this.config.getMonitoringGroups(),
      this.redis,
      ipinfoConfig.token,
      ipinfoConfig.cacheTtl,
    );

    this.logger.debug('Starting telemetry exporter...');
    await this.exporter.start();

    this.logger.debug('Waiting for initial node updates...');
    await new Promise(resolve => setTimeout(resolve, 7000));

    this.logger.debug('Pre-caching node locations...');
    await this.exporter.preCacheLocations();

    this.logger.log('Telemetry exporter initialized');
  }

  async onModuleDestroy() {
    this.logger.debug('Stopping telemetry exporter...');
    if (this.exporter) {
      await this.exporter.stop();
    }
    if (this.redis) {
      await this.redis.quit();
    }
    this.logger.log('Telemetry exporter stopped');
  }

  getNodeStates(chain: Chain.Polkadot | Chain.Kusama) {
    if (!this.exporter) {
      throw new Error('Telemetry exporter not initialized');
    }
    return this.exporter.getNodeStates(chain);
  }
}
