import type { AppLogger } from '@w3f/polguard-common';
import type { PolkadotClient } from 'polkadot-api';
import { ConfigService } from '../config/config.service';
import { ChainTelemetryService } from '../telemetry/chain-telemetry.service';
import { Store, IncidentReporter, getChainProperties } from '../../types';
import { ChainWatcher } from '../../lib/watcher';
import { IncidentHandler } from '../../lib/incident-handler';
import { createChainDataProvider } from '../../lib/data-provider';
import { getMonitoringGroups } from '@w3f/polguard-config';
import { connectChain, getTypedApi } from '../papi';

export class WatcherService {
  private client: PolkadotClient;
  private watcher: ChainWatcher;
  private persistenceInterval: NodeJS.Timeout;
  private stallGuard: NodeJS.Timeout;

  private static readonly STALL_CHECK_INTERVAL_MS = 30_000;
  private static readonly REBUILD_AFTER_MS = 2 * 60_000;
  private static readonly EXIT_AFTER_MS = 10 * 60_000;

  constructor(
    private readonly logger: AppLogger,
    private readonly config: ConfigService,
    private readonly telemetry: ChainTelemetryService,
    private readonly store: Store,
    private readonly reporter: IncidentReporter,
  ) {}

  async start(): Promise<void> {
    const chain = this.config.getChain();

    const watermark = await this.store.getLastBlock(chain);
    if (watermark !== null) {
      this.telemetry.recordProcessedBlock(watermark);
    }

    this.startStallGuard();

    // Config `startBlock` is a one-time bootstrap override; rebuilds resume from the Store watermark.
    await this.buildAndStart(this.config.getStartBlock());

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

  /** Builds the connection + watcher and starts processing. Re-run on rebuild. */
  private async buildAndStart(startBlock?: number): Promise<void> {
    const chain = this.config.getChain();
    const chainProps = getChainProperties(chain);
    const rpc = this.config.getRpcUrl();
    const configsDir = this.config.getMonitoringConfigsDir();

    this.client = await connectChain(rpc, this.logger, chain);

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
  }

  /**
   * Heals a stall in block progress: one in-process rebuild first, then a process exit for the
   * orchestrator to restart.
   */
  private startStallGuard(): void {
    let lastProgress: number | undefined;
    let lastProgressAt = Date.now();
    let rebuilt = false;

    this.stallGuard = setInterval(() => {
      const current = this.watcher?.getLastProcessedBlock();
      if (current !== undefined && current !== lastProgress) {
        lastProgress = current;
        lastProgressAt = Date.now();
        rebuilt = false;
        return;
      }

      const stalledMs = Date.now() - lastProgressAt;
      if (stalledMs > WatcherService.EXIT_AFTER_MS) {
        throw new Error(`No block progress in over ${WatcherService.EXIT_AFTER_MS}ms (stuck at ${current})`);
      }
      if (stalledMs > WatcherService.REBUILD_AFTER_MS && !rebuilt) {
        rebuilt = true;
        this.logger.error(
          `No block progress in over ${WatcherService.REBUILD_AFTER_MS}ms (stuck at ${current}). Rebuilding connection...`,
        );
        void this.rebuild();
      }
    }, WatcherService.STALL_CHECK_INTERVAL_MS);
  }

  /**
   * Tears down the current connection + watcher and rebuilds them (fresh client + chainHead follow).
   * A socket-level reconnect cannot clear a request hung on an invalidated follow, so we rebuild.
   * On rebuild the watcher resumes from the Store watermark (persisted every block), not the config
   * `startBlock`. If the rebuild itself fails, the rejection surfaces to the process-level handler in
   * `main.ts`, which exits cleanly for the orchestrator to restart.
   */
  private async rebuild(): Promise<void> {
    await this.watcher?.stop();
    this.client?.destroy();
    await this.buildAndStart();
    this.logger.info('Chain connection rebuilt.');
  }

  async stop(): Promise<void> {
    clearInterval(this.stallGuard);
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
      this.client?.destroy();
    }
  }
}
