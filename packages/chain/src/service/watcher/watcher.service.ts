import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown, Inject } from '@nestjs/common';
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
import { getTypedApi } from '../papi-descriptors';

@Injectable()
export class WatcherService implements OnApplicationBootstrap, OnApplicationShutdown {
  private client: PolkadotClient;
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
      this.client?.destroy();
    }
  }

  private async start(): Promise<void> {
    const chain = this.config.getChain();
    const chainProps = getChainProperties(chain);
    const rpc = this.config.getRpcUrl();
    const startBlock = this.config.getStartBlock();
    const configsDir = this.config.getMonitoringConfigsDir();

    this.client = await this.createClient(rpc, chainProps.specName);

    const runtimeClient = getTypedApi(this.client, chain);
    const chainDataProvider = createChainDataProvider(
      this.client,
      runtimeClient,
      this.store,
      this.logger,
      chainProps.chain,
    );
    const incidentHandler = new IncidentHandler(this.logger, this.store, this.reporter, chainProps.chain);
    const configLogger = new Logger('MonitoringConfig');

    this.watcher = new ChainWatcher(
      new Logger('ChainWatcher'),
      {
        getMonitoringGroups: () => getMonitoringGroups(chain, configsDir, configLogger),
      },
      this.store,
      this.client,
      runtimeClient,
      incidentHandler,
      chainProps,
      chainDataProvider,
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

  private async createClient(endpoint: string, expectedSpecName: string): Promise<PolkadotClient> {
    const provider = getWsProvider(endpoint);
    const client = createClient(provider);

    // Validate chain by checking runtime spec
    const { name: specName } = await client.getChainSpecData();
    if (specName !== expectedSpecName) {
      this.logger.warn(
        `Chain spec mismatch: expected "${expectedSpecName}" but RPC returns "${specName}". ` +
          `This may indicate a misconfigured RPC endpoint.`,
      );
    }

    this.logger.log(`Connected to RPC: ${endpoint}`);
    return client;
  }
}
