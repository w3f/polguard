import { ApiPromise, WsProvider } from '@polkadot/api';
import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from './config/config.service';
import { IncidentHandler } from '@lib/incident/incident-handler';
import { ChainWatcherStore } from '@lib/store/chain-watcher-store';
import { ChainWatcher } from '@lib/chain-watcher';
import { MetricsService } from './metrics/metrics.service';

@Injectable()
export class AppService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AppService.name);
  private chainWatcher: ChainWatcher;
  private api: ApiPromise;

  constructor(
    private config: ConfigService,
    private chainWatcherStore: ChainWatcherStore,
    private incidentHandler: IncidentHandler,
    private metricsService: MetricsService,
  ) {}

  async onModuleInit() {
    try {
      const chain = this.config.getChain();
      const groups = this.config.getMonitoringGroups(chain);

      const rpcUrls = this.config.getRPCs();
      // TODO: Implement reconnectable API
      this.api = await this.createApi(rpcUrls[0]);

      this.chainWatcher = new ChainWatcher(
        new Logger('ChainWatcher'),
        groups,
        this.api,
        this.incidentHandler,
        this.chainWatcherStore,
        this.metricsService,
      );

      this.logger.log('Starting ChainWatcher...');
      const startBlock = this.config.getStartBlock();
      await this.chainWatcher.start(startBlock);
    } catch (error) {
      await this.handleChainWatcherFailure(error);
    }
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
      this.logger.log('Stopping ChainWatcher...');
      await this.chainWatcher.stop();
      this.logger.log('ChainWatcher stopped.');
      if (this.api) {
        await this.api.disconnect();
        this.logger.log('API disconnected.');
      }
    } catch (error) {
      this.logger.error('Error during shutdown:', error.message);
      throw error;
    }
  }

  private async handleChainWatcherFailure(error: any) {
    this.logger.error('ChainWatcher failed:', error);

    try {
      await this.chainWatcher.stop();
      this.logger.log('ChainWatcher stopped after failure.');
      if (this.api) {
        await this.api.disconnect();
        this.logger.log('API disconnected after failure.');
      }
    } catch (stopError) {
      this.logger.error('Error during failure shutdown:', stopError);
    }

    this.logger.error('Exiting process due to ChainWatcher failure');
    process.exit(1);
  }
}
