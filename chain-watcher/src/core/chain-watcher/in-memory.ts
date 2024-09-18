import { AbstractChainWatcher } from './abstract-chain-watcher';

export class ChainWatcherInMemory extends AbstractChainWatcher {
  private lastProcessedBlock: number | null = null;

  protected async getLastProcessedBlock(): Promise<number> {
    if (this.lastProcessedBlock === null) {
      const lastHeader = await this.api.rpc.chain.getHeader();
      this.lastProcessedBlock = lastHeader.number.toNumber() - 1;
    }
    return this.lastProcessedBlock;
  }

  protected async setLastProcessedBlock(block: number): Promise<void> {
    this.lastProcessedBlock = block;
  }
}
