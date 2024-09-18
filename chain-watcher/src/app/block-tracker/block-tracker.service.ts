import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';

import { BlockTracker } from './block-tracker.entity.ts.js';
import { Chain } from '@core/constants.js';

@Injectable()
export class BlockTrackerService {
  constructor(private readonly em: EntityManager) {}

  async create(chain: Chain, block: number): Promise<BlockTracker> {
    const processedBlock = this.em.create(BlockTracker, { chain, block });
    await this.em.persistAndFlush(processedBlock);
    return processedBlock;
  }

  async getOrCreate(chain: Chain): Promise<BlockTracker> {
    let processedBlock = await this.em.findOne(BlockTracker, { chain });
    if (!processedBlock) {
      processedBlock = await this.create(chain, 0);
    }
    return processedBlock;
  }

  async update(chain: Chain, block: number): Promise<BlockTracker> {
    let processedBlock = await this.em.findOne(BlockTracker, { chain });

    if (processedBlock) {
      processedBlock.block = block;
      await this.em.persistAndFlush(processedBlock);
    } else {
      processedBlock = this.em.create(BlockTracker, { chain, block });
      await this.em.persistAndFlush(processedBlock);
    }
    return processedBlock;
  }
}
