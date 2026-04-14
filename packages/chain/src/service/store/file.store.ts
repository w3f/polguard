import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Store, Chain } from '../../types';
import * as JSONbig from 'json-bigint';
import * as fs from 'node:fs';
import * as path from 'node:path';

interface CacheEntry {
  payload: string;
  expiresAt?: number;
}

/**
 * FileStore: File-based persistent storage for standalone deployments
 *
 * Both KV and last block operations are persisted to disk using the same KV storage.
 * Last block is stored with special key pattern: __last_block__:{chain}
 *
 * Suitable for:
 * - Standalone deployments without Incident service
 * - Development/testing with persistence across restarts
 * - Small-scale production deployments
 *
 * Storage structure:
 * - Single JSON file with all KV data
 * - Periodic auto-save (every 30 seconds)
 * - Save on shutdown
 * - Cleanup of expired entries on load and periodically
 */
@Injectable()
export class FileStore implements Store, OnModuleDestroy {
  private readonly kv = new Map<string, CacheEntry>();
  private readonly logger = new Logger(FileStore.name);
  private readonly filePath: string;
  private cleanupInterval: NodeJS.Timeout;
  private saveInterval: NodeJS.Timeout;
  private isDirty = false;

  constructor(dataPath: string = 'data/chain-store.json') {
    this.filePath = path.resolve(process.cwd(), dataPath);

    // Ensure directory exists
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Load existing data
    this.load();

    // Periodic cleanup of expired entries
    const cleanupMs = 65_000;
    this.cleanupInterval = setInterval(() => this.cleanup(), cleanupMs);
    (this.cleanupInterval as any).unref?.();

    // Periodic save of dirty data
    const saveMs = 30_000;
    this.saveInterval = setInterval(() => {
      if (this.isDirty) {
        this.save();
      }
    }, saveMs);
    (this.saveInterval as any).unref?.();

    this.logger.debug(`File store initialized at ${this.filePath}`);
  }

  private load(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const data = fs.readFileSync(this.filePath, 'utf8');
        const parsed: Record<string, CacheEntry> = JSON.parse(data);

        const now = Date.now();
        let loadedCount = 0;

        for (const [key, entry] of Object.entries(parsed)) {
          // Skip expired entries
          if (entry.expiresAt && entry.expiresAt <= now) {
            continue;
          }
          this.kv.set(key, entry);
          loadedCount++;
        }

        this.logger.log(`Loaded ${loadedCount} entries from ${this.filePath}`);
      }
    } catch (error) {
      this.logger.error(`Failed to load store data: ${error.message}`);
    }
  }

  private save(): void {
    try {
      const data = Object.fromEntries(this.kv.entries());
      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf8');
      this.isDirty = false;
      this.logger.debug(`Saved ${this.kv.size} entries to ${this.filePath}`);
    } catch (error) {
      this.logger.error(`Failed to save store data: ${error.message}`);
    }
  }

  private cleanup(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, entry] of this.kv.entries()) {
      if (entry.expiresAt !== undefined && entry.expiresAt <= now) {
        this.kv.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.isDirty = true;
      this.logger.debug(`Cleaned up ${cleanedCount} expired entries`);
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.kv.get(key);
    if (!entry) return null;

    // Check expiration
    if (entry.expiresAt && entry.expiresAt <= Date.now()) {
      await this.del(key);
      return null;
    }

    try {
      return JSONbig.parse(entry.payload) as T;
    } catch {
      await this.del(key);
      return null;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.kv.set(key, { payload: JSONbig.stringify(value) });
    this.isDirty = true;
  }

  async setex<T>(key: string, seconds: number, value: T): Promise<void> {
    if (!Number.isFinite(seconds) || seconds < 0) {
      throw new Error(`Invalid TTL seconds: ${seconds}`);
    }
    if (seconds === 0) {
      return this.del(key);
    }
    this.kv.set(key, {
      payload: JSONbig.stringify(value),
      expiresAt: Date.now() + seconds * 1000,
    });
    this.isDirty = true;
  }

  async del(key: string): Promise<void> {
    if (this.kv.delete(key)) {
      this.isDirty = true;
    }
  }

  async exists(key: string): Promise<boolean> {
    const entry = this.kv.get(key);
    if (!entry) return false;

    // Check expiration
    if (entry.expiresAt && entry.expiresAt <= Date.now()) {
      await this.del(key);
      return false;
    }

    return true;
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
    clearInterval(this.saveInterval);

    // Final save on shutdown
    if (this.isDirty) {
      this.save();
      this.logger.log('Saved store data on shutdown');
    }
  }
}
