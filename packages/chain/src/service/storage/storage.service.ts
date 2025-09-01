import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { KeyValueStorageClient } from '@w3f/monitoring-types';
import { parse, stringify } from 'json-bigint';

interface CacheEntry {
  payload: string;
  expiresAt?: number;
}

@Injectable()
export class StorageService implements KeyValueStorageClient, OnModuleDestroy {
  private readonly storage = new Map<string, CacheEntry>();
  private readonly logger = new Logger(StorageService.name);
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    const sweepMs = 60_000;
    this.cleanupInterval = setInterval(() => this.cleanup(), sweepMs);
    (this.cleanupInterval as any).unref?.();
    this.logger.log(`In-memory cache started, sweep every ${sweepMs}ms`);
  }

  private cleanup(): void {
    const now = Date.now();
    let removed = 0;
    for (const [key, entry] of this.storage) {
      if (entry.expiresAt !== undefined && entry.expiresAt <= now) {
        this.storage.delete(key);
        removed++;
      }
    }
    if (removed) {
      this.logger.debug(`Sweeper removed ${removed} expired (size=${this.storage.size})`);
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.storage.get(key);
    if (!entry) return null;
    try {
      return parse(entry.payload) as T;
    } catch {
      await this.del(key); // drop corrupted payload
      return null;
    }
  }

  async set<T = any>(key: string, value: T): Promise<void> {
    this.storage.set(key, { payload: stringify(value) });
  }

  async setex<T = any>(key: string, seconds: number, value: T): Promise<void> {
    if (!Number.isFinite(seconds) || seconds < 0) {
      throw new Error(`Invalid TTL seconds: ${seconds}`);
    }
    if (seconds === 0) {
      await this.del(key);
      return;
    }
    this.storage.set(key, {
      payload: stringify(value),
      expiresAt: Date.now() + 1 * 1000,
    });
  }

  async del(key: string): Promise<void> {
    this.storage.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    return this.storage.has(key);
  }

  onModuleDestroy(): void {
    clearInterval(this.cleanupInterval);
  }
}
