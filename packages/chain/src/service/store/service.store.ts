import type { AppLogger } from '@w3f/polguard-common';
import { Store, Chain } from '../../types';
import { InMemoryStore } from './in-memory.store';
import { ConfigService } from '../config/config.service';

/**
 * ServiceStore: Hybrid storage for managed service mode
 *
 * Storage characteristics:
 * - KV operations: In-memory ephemeral cache
 *   Purpose: Track ongoing incident IDs between fire/resolve cycles, working as cache for data provider
 *   Durability: Not needed - incidents are already persisted in API postgres
 *   On restart: Cache is empty, but idempotency at API level prevents duplicate creation
 *
 * - Last block operations: Remote persistent storage via HTTP
 *   Purpose: Share processing state across chain service restarts/instances
 *   Durability: Required to prevent reprocessing blocks
 *
 * We use hybrid approach because incident data lives in the Incident service's db,
 * while the KV cache is just a performance optimization for tracking
 * incident IDs locally.
 */
export class ServiceStore implements Store {
  private readonly lastBlockUrl: string;
  private readonly kv: InMemoryStore;

  constructor(
    private readonly config: ConfigService,
    private readonly logger: AppLogger,
  ) {
    // KV operations use in-memory store (ephemeral cache)
    this.kv = new InMemoryStore(logger);

    // Last block operations use HTTP (persistent via Incident service)
    const storeConfig = this.config.getStoreConfig();
    this.lastBlockUrl = storeConfig.service!.url;
  }

  // KV operations: delegate to in-memory store (ephemeral)
  async get<T>(key: string): Promise<T | null> {
    return this.kv.get<T>(key);
  }

  async set<T>(key: string, value: T): Promise<void> {
    return this.kv.set(key, value);
  }

  async setex<T>(key: string, seconds: number, value: T): Promise<void> {
    return this.kv.setex(key, seconds, value);
  }

  async del(key: string): Promise<void> {
    return this.kv.del(key);
  }

  async exists(key: string): Promise<boolean> {
    return this.kv.exists(key);
  }

  // Last block operations: use HTTP (persistent)
  async getLastBlock(chain: Chain): Promise<number | null> {
    try {
      const url = this.lastBlockUrl.replace(':chain', chain);
      const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const text = await response.text();
      if (!text) return null;
      const data = JSON.parse(text);
      return data?.blockNumber ?? null;
    } catch (error) {
      throw new Error(`Failed to get last block for chain ${chain}: ${(error as Error).message}`);
    }
  }

  async setLastBlock(chain: Chain, blockNumber: number): Promise<void> {
    try {
      const url = this.lastBlockUrl.replace(':chain', chain);
      const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blockNumber }),
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) {
        if (response.status === 409) {
          // Block already processed, this is fine
          return;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      if ((error as any).status === 409) return;
      throw new Error(`Failed to set last block for chain ${chain}: ${(error as Error).message}`);
    }
  }

  destroy(): void {
    this.kv.destroy();
  }
}
