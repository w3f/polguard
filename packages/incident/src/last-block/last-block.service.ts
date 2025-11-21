import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LastBlock } from '../database/last-block.entity';
import { Chain } from '@w3f/polguard-common';

@Injectable()
export class LastBlockService {
  constructor(
    @InjectRepository(LastBlock)
    private lastBlockRepository: Repository<LastBlock>,
  ) {}

  async getLastBlock(chain: Chain): Promise<LastBlock | null> {
    return this.lastBlockRepository.findOne({ where: { chain } });
  }

  async setLastBlock(chain: Chain, blockNumber: number): Promise<void> {
    const lastBlock = await this.getLastBlock(chain);

    if (lastBlock) {
      if (blockNumber < lastBlock.blockNumber) {
        throw new ConflictException(`Block ${blockNumber} has already been processed for chain ${chain}.`);
      }
      if (blockNumber > lastBlock.blockNumber) {
        await this.lastBlockRepository.update({ chain }, { blockNumber });
      }
      return;
    }

    await this.lastBlockRepository.save({ chain, blockNumber });
  }
}
