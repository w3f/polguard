import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown, Inject } from '@nestjs/common';
import { ApiPromise, WsProvider } from '@polkadot/api';
import { ConfigService } from '../config/config.service';
import { ChainTelemetryService } from '../telemetry/chain-telemetry.service';
import { getChainProperties, Store, IncidentReporter } from '@w3f/monitoring-types';
import { ChainWatcher } from '../../lib/watcher';
import { IncidentHandler } from '../../lib/incident-handler';
import { createChainDataProvider } from '../../lib/data-provider';
import { getMonitoringGroups } from '@w3f/monitoring-config';

@Injectable()
export class WatcherService implements OnApplicationBootstrap, OnApplicationShutdown {
  private api: ApiPromise;
  private watcher: ChainWatcher;

  constructor(
    private readonly logger: Logger,
    private readonly config: ConfigService,
    private readonly telemetry: ChainTelemetryService,
    @Inject('Store') private readonly store: Store,
    @Inject('IncidentReporter') private readonly reporter: IncidentReporter,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.start();
  }

  async onApplicationShutdown(): Promise<void> {
    try {
      // Flush last processed block to Store on shutdown
      const lastProcessed = this.watcher?.getLastProcessedBlock();
      if (lastProcessed !== undefined) {
        const chain = this.config.getChain();
        this.logger.log(`Flushing last processed block ${lastProcessed} for chain ${chain}`);
        await this.store.setLastBlock(chain, lastProcessed);
      }
    } catch (error) {
      this.logger.error(`Failed to flush last processed block: ${error.message}`);
    } finally {
      await this.watcher?.stop();
      await this.api?.disconnect();
    }
  }

  private async start(): Promise<void> {
    const chain = this.config.getChain();
    const chainProps = getChainProperties(chain);
    const rpc = this.config.getRpcUrl();
    const startBlock = this.config.getStartBlock();
    const configsDir = this.config.getMonitoringConfigsDir();

    this.api = await this.createApi(rpc, chainProps.specName);
    const chainDataProvider = createChainDataProvider(this.api, this.store, this.logger, chainProps.chain);
    const incidentHandler = new IncidentHandler(this.logger, this.store, this.reporter, chainProps.chain);
    const configLogger = new Logger('MonitoringConfig');

    this.watcher = new ChainWatcher(
      new Logger('ChainWatcher'),
      {
        getMonitoringGroups: () => getMonitoringGroups(chain, configsDir, configLogger),
      },
      this.store,
      this.api,
      incidentHandler,
      chainProps,
      chainDataProvider,
      this.telemetry,
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
