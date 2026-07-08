import type { AppLogger } from '@w3f/polguard-common';
import type { PolkadotClient } from 'polkadot-api';
import { ConfigService } from '../config/config.service';
import { ChainTelemetryService } from '../telemetry/chain-telemetry.service';
import { Store, IncidentReporter, getChainProperties } from '../../types';
import { ChainWatcher } from '../../lib/watcher';
import { IncidentHandler } from '../../lib/incident-handler';
import { createChainDataProvider } from '../../lib/data-provider';
import { getMonitoringGroups } from '@w3f/polguard-config';
import { getTypedApi } from '../papi-descriptors';
import { ChainConnection } from '../chain-connection';

export class WatcherService {
  private conn: ChainConnection;
  private client: PolkadotClient;
  private watcher: ChainWatcher;
  private persistenceInterval: NodeJS.Timeout;

  constructor(
    private readonly logger: AppLogger,
    private readonly config: ConfigService,
    private readonly telemetry: ChainTelemetryService,
    private readonly store: Store,
    private readonly reporter: IncidentReporter,
  ) {}

  async start(): Promise<void> {
    const chain = this.config.getChain();
    const chainProps = getChainProperties(chain);
    const rpc = this.config.getRpcUrl();
    const startBlock = this.config.getStartBlock();
    const configsDir = this.config.getMonitoringConfigsDir();

    this.conn = await ChainConnection.connect(rpc, this.logger, { expectedSpecName: chainProps.specName });
    this.client = this.conn.client;

    const runtimeClient = getTypedApi(this.client, chain);
    const chainDataProvider = createChainDataProvider(
      this.client,
      runtimeClient,
      this.store,
      this.logger,
      chainProps.chain,
    );
    const incidentHandler = new IncidentHandler(this.logger, this.store, this.reporter, chainProps.chain);

    this.watcher = new ChainWatcher(
      this.logger,
      {
        getMonitoringGroups: () => getMonitoringGroups(chain, configsDir, this.logger),
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

    // Guards against a stuck RPC connection
    this.conn.startStuckGuard(() => this.watcher?.getLastProcessedBlock());
  }

  async stop(): Promise<void> {
    try {
      if (this.persistenceInterval) {
        clearInterval(this.persistenceInterval);
      }

      // Flush last processed block to Store on shutdown
      const lastProcessed = this.watcher?.getLastProcessedBlock();
      if (lastProcessed !== undefined) {
        const chain = this.config.getChain();
        this.logger.info(`Flushing last processed block ${lastProcessed} for chain ${chain}`);
        await this.store.setLastBlock(chain, lastProcessed);
      }
    } catch (error) {
      this.logger.error(`Failed to flush last processed block: ${(error as Error).message}`);
    } finally {
      await this.watcher?.stop();
      this.conn?.destroy();
    }
  }
}
