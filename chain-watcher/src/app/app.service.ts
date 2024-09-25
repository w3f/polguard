import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { AbstractChainWatcher } from '@core/chain-watcher/abstract-chain-watcher';
import { ReconnectableApi } from '@core/api/reconnectable-api';
import { BlockTrackerService } from './block-tracker/block-tracker.service';
import { ConfigService } from './config/config.service';
import { EventDispatcherService } from './event-dispatcher.service';

@Injectable()
export class AppService extends AbstractChainWatcher implements OnModuleInit, OnModuleDestroy {
  constructor(
    protected logger: Logger,
    protected eventDispatcher: EventDispatcherService,
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

  protected async getLastProcessedBlock(): Promise<number> {
    const processedBlock = await this.blockTracker.getOrCreate(this.chain);
    return processedBlock.block;
  }

  protected async setLastProcessedBlock(block: number): Promise<void> {
    await this.blockTracker.update(this.chain, block);
  }
}
