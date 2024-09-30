import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ChainWatcher } from '@core/chain-watcher';
import { ConfigService } from './config/config.service';
import { IncidentHandler } from '@core/incident/incident-handler';
import { ChainWatcherStore } from '@core/store/chain-watcher-store';
import { RedisClient } from '@core/interfaces';
import { ApiPromise, WsProvider } from '@polkadot/api';

@Injectable()
export class AppService implements OnModuleInit, OnModuleDestroy {
  private chainWatcher: ChainWatcher;
  private incidentHandler: IncidentHandler;
  private store: ChainWatcherStore;
  private api: ApiPromise;

  constructor(
    private logger: Logger,
    private config: ConfigService,
    private redisClient: RedisClient
  ) {}

  async onModuleInit() {
    try {
      const chain = this.config.getChain();
      const groups = this.config.getMonitoringGroups(chain);
      this.store = new ChainWatcherStore(this.redisClient);
      this.incidentHandler = new IncidentHandler(this.store, chain);

      // TODO: Implement reconnectable API
      const rpcUrls = this.config.getRPCs();
      this.api = await this.createApi(rpcUrls[0]);

      this.chainWatcher = new ChainWatcher(
        this.logger,
        groups,
        this.api,
        this.incidentHandler,
        this.store
      );

      this.logger.log('Starting ChainWatcher...');
      await this.chainWatcher.start();
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
      const lastProcessedBlock = await this.chainWatcher.getLastProcessedBlock();
      const failureBlockNumber = lastProcessedBlock + 1;

      await this.incidentHandler.handleInstantIncident(
        `system:failure:${failureBlockNumber}`,
        `ChainWatcher failed: ${error.message}`,
        this.config.getAppFailureAlertSettings(),
        failureBlockNumber
      );
    } catch (emitError) {
      this.logger.error('Failed to emit incident:', emitError);
    }

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
