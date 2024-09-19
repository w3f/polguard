import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AbstractChainWatcher } from '@core/index';
import { Incident } from '@core/interfaces';
import { BlockTrackerService } from './block-tracker/block-tracker.service';
import { ConfigService } from './config-services/config.service';
import EventEmitter from 'events';
import { ApiFactory } from '@core/api/api-factory';

@Injectable()
export class AppService extends AbstractChainWatcher implements OnModuleInit, OnModuleDestroy {
  constructor(
    protected logger: Logger,
    private eventEmitter: EventEmitter2,
    private blockTracker: BlockTrackerService,
    private config: ConfigService
  ) {
    const eventDispatcher = new EventEmitter();
    const chain = config.getChain()
    const rpcs = config.getRPCs()
    const groups = config.getMonitoringGroups(chain);

    // TODO: initalize api
    // const api = ApiFactory.create(rpcs)
    super(logger, chain, groups, eventDispatcher, api);
    // TODO: refactor event emitters
    // We have two event emitters, one for the chain watcher and another one for the app
    eventDispatcher.on('newIncident', (incident: Incident) => {
      this.eventEmitter.emit('newIncident', incident);
    });
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
