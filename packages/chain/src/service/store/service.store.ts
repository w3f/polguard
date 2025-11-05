import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Store, Chain } from '@w3f/monitoring-types';
import { InMemoryStore } from './in-memory.store';
import { ConfigService } from '../config/config.service';
import { lastValueFrom } from 'rxjs';

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
 * We use hybrid approach because incident data lives in the API service's db,
 * while the KV cache is just a performance optimization for tracking
 * incident IDs locally.
 */
@Injectable()
export class ServiceStore implements Store {
  private readonly getUrl: string;
  private readonly setUrl: string;
  private readonly kv: InMemoryStore;

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {
    // KV operations use in-memory store (ephemeral cache)
    this.kv = new InMemoryStore();

    // Last block operations use HTTP (persistent via API service)
    const storeConfig = this.config.getStoreConfig();
    this.getUrl = `${storeConfig.baseUrl}${storeConfig.endpoints.getLastBlock}`;
    this.setUrl = `${storeConfig.baseUrl}${storeConfig.endpoints.setLastBlock}`;
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
      const url = this.getUrl.replace(':chain', chain);
      const response = await lastValueFrom(this.http.get(url));
      return response.data?.blockNumber ?? null;
    } catch (error) {
      throw new Error(`Failed to get last block for chain ${chain}: ${error.message}`);
    }
  }

  async setLastBlock(chain: Chain, blockNumber: number): Promise<void> {
    try {
      await lastValueFrom(this.http.post(this.setUrl, { chain, blockNumber }));
    } catch (error) {
      if (error.response?.status === 409) {
        // Block already processed, this is fine
        return;
      }
      throw new Error(`Failed to set last block for chain ${chain}: ${error.message}`);
    }
  }
}
