import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown, Inject } from '@nestjs/common';
import { ApiPromise, WsProvider } from '@polkadot/api';
import { getWsProvider } from 'polkadot-api/ws';
import { createClient } from 'polkadot-api';
import type { PolkadotClient } from 'polkadot-api';
import { ConfigService } from '../config/config.service';
import { ChainTelemetryService } from '../telemetry/chain-telemetry.service';
import { Store, IncidentReporter, getChainProperties } from '../../types';
import { ChainWatcher } from '../../lib/watcher';
import { IncidentHandler } from '../../lib/incident-handler';
import { createChainDataProvider } from '../../lib/data-provider';
import { getMonitoringGroups } from '@w3f/polguard-config';
import { getTypedApi } from '../../lib/papi-descriptors';

@Injectable()
export class WatcherService implements OnApplicationBootstrap, OnApplicationShutdown {
  private api: ApiPromise;
  private papiClient: PolkadotClient;
  private watcher: ChainWatcher;
  private persistenceInterval: NodeJS.Timeout;

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
      if (this.persistenceInterval) {
        clearInterval(this.persistenceInterval);
      }

      // Flush last processed block to Store on shutdown
      const lastProcessed = this.watcher?.getLastProcessedBlock();
      if (lastProcessed !== undefined) {
        const chain = this.config.getChain();
        this.logger.log(`Flushing last processed block ${lastProcessed} for chain ${chain}`);
        await this.store.setLastBlock(chain, lastProcessed);
      }
    } catch (error) {
      this.logger.error(`Failed to flush last processed block: ${(error as Error).message}`);
    } finally {
      await this.watcher?.stop();
      await this.api?.disconnect();
      this.papiClient?.destroy();
    }
  }

  private async start(): Promise<void> {
    const chain = this.config.getChain();
    const chainProps = getChainProperties(chain);
    const rpc = this.config.getRpcUrl();
    const startBlock = this.config.getStartBlock();
    const configsDir = this.config.getMonitoringConfigsDir();

    // Initialize both PJS and PAPI clients
    this.api = await this.createApi(rpc, chainProps.specName);
    this.papiClient = await this.createPapiClient(rpc, chainProps.specName);

    const typedApi = getTypedApi(this.papiClient, chain);
    const chainDataProvider = createChainDataProvider(
      this.papiClient,
      this.store,
      this.logger,
      chainProps.chain,
      typedApi,
    );
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
      typedApi,
      this.telemetry,
    );

    await this.watcher.start(startBlock);

    // This ensures progress is saved even if the process crashes (OOM, SIGKILL, etc.)
    const persistenceIntervalMs = 5 * 60 * 1000; // 5 minutes
    this.persistenceInterval = setInterval(async () => {
      try {
        const lastProcessed = this.watcher?.getLastProcessedBlock();
        if (lastProcessed !== undefined) {
          await this.store.setLastBlock(chain, lastProcessed);
          this.logger.debug(`Persisted last processed block: ${lastProcessed}`);
        }
      } catch (error) {
        this.logger.error(`Failed to persist last processed block: ${(error as Error).message}`);
      }
    }, persistenceIntervalMs);
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

  private async createPapiClient(endpoint: string, expectedSpecName: string): Promise<PolkadotClient> {
    const provider = getWsProvider(endpoint);
    const client = createClient(provider);

    // Validate chain by checking runtime spec
    const { name: specName } = await client.getChainSpecData();
    this.logger.debug(
      `Chain mismatch: Config chain is "${expectedSpecName}" but RPC endpoint returns "${specName}". Please check your configuration.`,
    );
    // if (specName !== expectedSpecName) {
    //   client.destroy();
    //   throw new Error(
    //     `Chain mismatch: Config chain is "${expectedSpecName}" but RPC endpoint returns "${specName}". Please check your configuration.`,
    //   );
    // }

    this.logger.log(`PAPI client connected to RPC: ${endpoint}`);
    return client;
  }
}
