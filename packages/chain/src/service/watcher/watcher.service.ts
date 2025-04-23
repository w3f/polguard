import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { ApiPromise, WsProvider } from '@polkadot/api';
import { ConfigService } from '../config/config.service';
import { MonitoringConfigService } from '../monitoring-config/monitoring-config.service';
import { StorageService } from '../storage/storage.service';
import { getChainProperties } from '@w3f/monitoring-types';
import { ChainWatcher } from '../../lib/watcher';
import { IncidentHandler } from '../../lib/incident-handler';
import { createChainDataProvider } from '../../lib/data-provider';
import { IncidentApiService } from '../incident/incident-publisher.service';

@Injectable()
export class WatcherService implements OnApplicationBootstrap, OnApplicationShutdown {
  private api: ApiPromise;
  private watcher: ChainWatcher;

  constructor(
    private readonly logger: Logger,
    private readonly config: ConfigService,
    private readonly monitoringConfig: MonitoringConfigService,
    private readonly storage: StorageService,
    private readonly incidents: IncidentApiService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.start();
  }

  async onApplicationShutdown(): Promise<void> {
    await this.watcher.stop();
    await this.api.disconnect();
  }

  private async start(): Promise<void> {
    const chain = this.config.getChain();
    const chainProps = getChainProperties(chain);
    const rpc = this.config.getRpcUrl();
    const startBlock = this.config.getStartBlock();

    this.api = await this.createApi(rpc, chainProps.specName);
    const chainDataProvider = createChainDataProvider(this.api, this.storage, this.logger);
    const incidentHandler = new IncidentHandler(this.logger, this.storage, this.incidents, chainProps.chain);

    this.watcher = new ChainWatcher(
      new Logger('ChainWatcher'),
      this.monitoringConfig,
      this.api,
      incidentHandler,
      this.storage,
      chainProps,
      chainDataProvider,
    );

    await this.watcher.start(startBlock);
  }

  private async createApi(endpoint: string, expectedSpecName: string): Promise<ApiPromise> {
    const provider = new WsProvider(endpoint);
    const api = await ApiPromise.create({ provider, noInitWarn: true });
    await api.isReady;

    // Validate chain
    const specName = api.runtimeVersion.specName.toString();
    if (specName !== expectedSpecName) {
      throw new Error(
        `Chain mismatch: Config chain is "${expectedSpecName}" but RPC endpoint returns "${specName}". Please check your configuration.`,
      );
    }

    this.logger.log(`Connected to RPC: ${endpoint}`);
    return api;
  }
}
