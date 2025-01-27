import { ApiPromise, WsProvider } from '@polkadot/api';
import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from './config/config.service';
import { ChainWatcher } from '@lib/chain/chain-watcher';
// TODO: import { TelemetryWatcher } from '@lib/telemetry/telemetry-watcher';
import { MetricsService } from './metrics/metrics.service';
import { createChainWatcher, ChainWatcherDependencies } from '@lib/chain/chain-watcher-factory';
// TODO: import { createTelemetryWatcher, TelemetryWatcherDependencies } from '@lib/telemetry/telemetry-watcher-factory';
import { StorageService } from './storage/storage.service';
import { IncidentPublisherService } from './incident/incident-publisher.service';
import { getChainProperties } from '@w3f/monitoring-types';

/**
 * Main application service responsible for:
 * 1. Initializing and managing chain and telemetry watchers
 * 2. Managing connections to blockchain node and telemetry API
 * 3. Handling application lifecycle
 */
@Injectable()
export class AppService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AppService.name);
  private chainWatcher: ChainWatcher;
  // TODO: private telemetryWatcher: TelemetryWatcher;
  private api: ApiPromise;

  constructor(
    private config: ConfigService,
    private storageService: StorageService,
    private incidentPublisherService: IncidentPublisherService,
    private metricsService: MetricsService,
    // TODO: private telemetryApiService: TelemetryApiService,
  ) {}

  async onModuleInit() {
    try {
      await this.initializeWatchers();
    } catch (error) {
      await this.handleInitializationFailure(error);
    }
  }

  private async initializeWatchers() {
    const chain = this.config.getChain();
    const groups = this.config.getMonitoringGroups(chain);
    const chainProps = getChainProperties(chain);

    // Initialize chain watcher
    this.api = await this.createApi(this.config.getRPCs()[0]);

    const chainDependencies: ChainWatcherDependencies = {
      logger: new Logger('ChainWatcher'),
      api: this.api,
      storageClient: this.storageService,
      eventEmitterClient: this.incidentPublisherService,
      metricsClient: this.metricsService,
      chainProps,
    };

    this.chainWatcher = await createChainWatcher(groups, chainDependencies);

    // TODO: Initialize telemetry watcher if enabled in config
    /* if (this.config.isTelemetryEnabled()) {
      const telemetryDependencies: TelemetryWatcherDependencies = {
        logger: new Logger('TelemetryWatcher'),
        telemetryApi: this.telemetryApiService,
        storageClient: this.storageService,
        eventEmitterClient: this.incidentPublisherService,
        metricsClient: this.metricsService,
        chainProps,
      };

      this.telemetryWatcher = await createTelemetryWatcher(groups, telemetryDependencies);
    } */

    // Start watchers
    this.logger.log('Starting watchers...');
    await this.chainWatcher.start(this.config.getStartBlock());
    // TODO: await this.telemetryWatcher?.start();
    this.logger.log('Watchers started successfully');
  }

  private async createApi(rpcUrl: string): Promise<ApiPromise> {
    const provider = new WsProvider(rpcUrl);
    const api = await ApiPromise.create({ provider, noInitWarn: true });
    await api.isReady;
    this.logger.log(`Connected to RPC: ${rpcUrl}`);
    return api;
  }

  async onModuleDestroy() {
    try {
      this.logger.log('Stopping watchers...');
      await this.chainWatcher?.stop();
      // TODO: await this.telemetryWatcher?.stop();
      this.logger.log('Watchers stopped.');

      if (this.api) {
        await this.api.disconnect();
        this.logger.log('Chain API disconnected.');
      }
      // TODO: await this.telemetryApiService?.disconnect();
    } catch (error) {
      this.logger.error('Error during shutdown:', error);
      throw error;
    }
  }

  /**
   * Handles critical failures during initialization that make the application unusable.
   */
  private async handleInitializationFailure(error: unknown) {
    this.logger.error('Failed to initialize watchers.', error);
    try {
      await this.chainWatcher?.stop();
      // TODO: await this.telemetryWatcher?.stop();
      await this.api?.disconnect();
      // TODO: await this.telemetryApiService?.disconnect();
    } catch (shutdownError) {
      this.logger.error('Error during failure shutdown:', shutdownError);
    }
    process.exit(1);
  }
}
