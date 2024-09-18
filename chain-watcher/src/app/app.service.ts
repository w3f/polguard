import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AbstractChainWatcher } from '@core/index';
import { Incident } from '@core/interfaces';
import { BlockTrackerService } from './block-tracker/block-tracker.service';
import { ChainWatcherConfigService } from './config-services/chain-watcher-config.service';
import { AppConfigService } from './config-services/app-config.service';
import EventEmitter from 'events';

@Injectable()
export class AppService extends AbstractChainWatcher implements OnModuleInit, OnModuleDestroy {
  constructor(
    protected logger: Logger,
    private eventEmitter: EventEmitter2,
    private blockTracker: BlockTrackerService,
    private appConfig: AppConfigService,
    private chainWatcherConfig: ChainWatcherConfigService
  ) {
    // TODO: refactor this
    const eventDispatcher = new EventEmitter();
    super(logger, appConfig.getChain(), eventDispatcher);
    // We have two event emitters, one for the chain watcher and another one for the app
    eventDispatcher.on('newIncident', (incident: Incident) => {
      this.eventEmitter.emit('newIncident', incident);
    });
  }

  async onModuleInit() {
    try {
      this.logger.log('Fetching monitoring configurations...');
      await this.chainWatcherConfig.fetchConfigs();
      this.logger.log('Monitoring configurations fetched successfully.');
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
