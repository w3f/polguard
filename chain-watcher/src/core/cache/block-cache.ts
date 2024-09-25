import NodeCache from 'node-cache';
import { CacheKey } from '../constants';

export class BlockCache {
  private static instance: BlockCache;
  private cache: NodeCache;

  private constructor() {
    // Set TTL to 5 minutes (300 seconds)
    this.cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });
  }

  static getInstance(): BlockCache {
    if (!BlockCache.instance) {
      BlockCache.instance = new BlockCache();
    }
    return BlockCache.instance;
  }

  private getKey(blockNumber: number, dataType: string): string {
    return `${blockNumber}_${dataType}`;
  }

  set<T>(blockNumber: number, key: CacheKey, data: T): void {
    const cacheKey = this.getKey(blockNumber, key);
    this.cache.set(cacheKey, data);
  }

  get<T>(blockNumber: number, key: CacheKey): T | undefined {
    const cacheKey = this.getKey(blockNumber, key);
    return this.cache.get<T>(cacheKey);
  }

}
