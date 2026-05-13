import { eq } from 'drizzle-orm';
import { ConflictError } from '@w3f/polguard-common';
import type { Database } from '../database/db';
import { lastBlocks } from '../database/schema';
import { Chain } from '@w3f/polguard-common';

export class LastBlockService {
  constructor(private readonly db: Database) {}

  async getLastBlock(chain: Chain) {
    const result = await this.db.select().from(lastBlocks).where(eq(lastBlocks.chain, chain)).limit(1);
    return result[0] ?? null;
  }

  async setLastBlock(chain: Chain, blockNumber: number): Promise<void> {
    const lastBlock = await this.getLastBlock(chain);

    if (lastBlock) {
      if (blockNumber < lastBlock.blockNumber) {
        throw new ConflictError(`Block ${blockNumber} has already been processed for chain ${chain}.`);
      }
      if (blockNumber > lastBlock.blockNumber) {
        await this.db.update(lastBlocks).set({ blockNumber, updatedAt: new Date() }).where(eq(lastBlocks.chain, chain));
      }
      return;
    }

    await this.db.insert(lastBlocks).values({ chain, blockNumber });
  }
}
