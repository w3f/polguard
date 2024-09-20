import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { AbstractChainWatcher } from '@core/index';
import { BlockTrackerService } from './block-tracker/block-tracker.service';
import { ConfigService } from './config-services/config.service';
import { ReconnectableApi } from '@core/polkadot-api/reconnectable-api';
import { EventDispatcherAdapter } from './event-dispatcher.adapter';

@Injectable()
export class AppService extends AbstractChainWatcher implements OnModuleInit, OnModuleDestroy {
  constructor(
    protected logger: Logger,
    protected eventDispatcher: EventDispatcherAdapter,
    private blockTracker: BlockTrackerService,
    private config: ConfigService,
    private reconnectableApi: ReconnectableApi
  ) {
    const chain = config.getChain();
    const groups = config.getMonitoringGroups(chain);
    super(logger, chain, groups, eventDispatcher, reconnectableApi.getApi());
  }

  async onModuleInit() {
    try {
      this.logger.log('Starting ChainWatcher...');
      await this.start();
    } catch (error) {
      this.logger.error(error.message);
      throw error;
    }
  }
  
  async onModuleDestroy() {
    try {
      this.logger.log('Stopping ChainWatcher...');
      await this.stop();
      this.logger.log('ChainWatcher stopped.');
    } catch (error) {
      this.logger.error(error.message);
      throw error;
    }
  }
  /**
   * Implements Chain Watcher method to retrieve the last processed block.
   * Uses ORM to fetch or create a record for the current chain.
   */
  protected async getLastProcessedBlock(): Promise<number> {
    const processedBlock = await this.blockTracker.getOrCreate(this.chain);
    return processedBlock.block;
  }
  /**
   * Implements Chain Watcher method to update the last processed block.
   * Uses ORM to persist the latest block number for the current chain.
   */
  protected async setLastProcessedBlock(block: number): Promise<void> {
    await this.blockTracker.update(this.chain, block);
  }
}
