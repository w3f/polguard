import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Store, Chain } from '@w3f/monitoring-types';
import { parse, stringify } from 'json-bigint';

interface CacheEntry {
  payload: string;
  expiresAt?: number;
}

/**
 * InMemoryStore: Fully ephemeral storage for development/testing
 *
 * Both KV and last block operations use the same in-memory KV storage.
 * Last block is stored with special key pattern: __last_block__:{chain}
 * All data is lost on process restart.
 *
 * Suitable for:
 * - Local development
 * - Testing
 * - Temporary monitoring experiments
 *
 * NOT suitable for production use without understanding data loss implications.
 */
@Injectable()
export class InMemoryStore implements Store, OnModuleDestroy {
  private readonly kv = new Map<string, CacheEntry>();
  private readonly logger = new Logger(InMemoryStore.name);
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    const sweepMs = 60_000;
    this.cleanupInterval = setInterval(() => this.cleanup(), sweepMs);
    (this.cleanupInterval as any).unref?.();
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.kv) {
      if (entry.expiresAt !== undefined && entry.expiresAt <= now) {
        this.kv.delete(key);
      }
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.kv.get(key);
    if (!entry) return null;
    try {
      return parse(entry.payload) as T;
    } catch {
      await this.del(key);
      return null;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.kv.set(key, { payload: stringify(value) });
  }

  async setex<T>(key: string, seconds: number, value: T): Promise<void> {
    if (!Number.isFinite(seconds) || seconds < 0) {
      throw new Error(`Invalid TTL seconds: ${seconds}`);
    }
    if (seconds === 0) {
      return this.del(key);
    }
    this.kv.set(key, {
      payload: stringify(value),
      expiresAt: Date.now() + seconds * 1000,
    });
  }

  async del(key: string): Promise<void> {
    this.kv.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    return this.kv.has(key);
  }

  // Last block operations use special KV keys
  private getLastBlockKey(chain: Chain): string {
    return `__last_block__:${chain}`;
  }

  async getLastBlock(chain: Chain): Promise<number | null> {
    return this.get<number>(this.getLastBlockKey(chain));
  }

  async setLastBlock(chain: Chain, blockNumber: number): Promise<void> {
    return this.set(this.getLastBlockKey(chain), blockNumber);
  }

  onModuleDestroy(): void {
    clearInterval(this.cleanupInterval);
  }
}
