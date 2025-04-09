import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { ApiPromise, WsProvider } from '@polkadot/api';
import { ConfigService } from '../config/config.service';
import { MetricsService } from '../metrics/metrics.service';
import { StorageService } from '../storage/storage.service';
import { TelemetryService } from '../telemetry/telemetry.service';
import { WatcherType, getChainProperties } from '@w3f/monitoring-types';
import { createChainWatcher, ChainWatcherDependencies } from '../../lib/chain/chain-watcher-factory';
import { createTelemetryWatcher, TelemetryWatcherDependencies } from '../../lib/telemetry/telemetry-watcher-factory';
import { AbstractWatcher } from '../../lib/common/abstract-watcher';
import { IncidentApiService } from '../incident/incident-publisher.service';

@Injectable()
export class WatcherService implements OnApplicationBootstrap, OnApplicationShutdown {
  private api: ApiPromise | null = null;
  private watcher: AbstractWatcher<any, any, any>;

  constructor(
    private readonly logger: Logger,
    private readonly config: ConfigService,
    private readonly metrics: MetricsService,
    private readonly storage: StorageService,
    private readonly telemetry: TelemetryService | null,
    private readonly incidents: IncidentApiService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.start();
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.watcher) {
      await this.watcher.stop();
    }
    if (this.api) {
      await this.api.disconnect();
    }
  }

  private async start(): Promise<void> {
    const chain = this.config.getChain();
    const groups = this.config.getMonitoringGroups(chain);
    const chainProps = getChainProperties(chain);

    if (this.config.getWatcherType() === WatcherType.Chain) {
      const chainConfig = this.config.getChainConfig();
      // Initialize chain watcher
      this.api = await this.createApi(chainConfig.rpcs[0]);

      const chainDependencies: ChainWatcherDependencies = {
        logger: new Logger('ChainWatcher'),
        api: this.api,
        storageClient: this.storage,
        incidentApiClient: this.incidents,
        metricsClient: this.metrics,
        chainProps,
      };

      this.watcher = await createChainWatcher(groups, chainDependencies);
      await this.watcher.start(chainConfig.startBlock);
    } else {
      // Initialize telemetry watcher
      if (!this.telemetry) {
        throw new Error('TelemetryService is required for Telemetry watcher');
      }
      const telemetryConfig = this.config.getTelemetryConfig();

      const telemetryDependencies: TelemetryWatcherDependencies = {
        logger: new Logger('TelemetryWatcher'),
        storageClient: this.storage,
        incidentApiClient: this.incidents,
        metricsClient: this.metrics,
        telemetryClient: this.telemetry,
        chainProps,
        interval: telemetryConfig.interval,
      };

      this.watcher = await createTelemetryWatcher(groups, telemetryDependencies);
      await this.watcher.start();
    }
  }

  private async createApi(endpoint: string): Promise<ApiPromise> {
    const provider = new WsProvider(endpoint);
    const api = await ApiPromise.create({ provider, noInitWarn: true });
    await api.isReady;
    this.logger.log(`Connected to RPC: ${endpoint}`);
    return api;
  }
}
