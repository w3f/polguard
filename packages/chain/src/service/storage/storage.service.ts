import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import type { LocalStorage } from 'node-persist';
import * as nodePersist from 'node-persist';
import { KeyValueStorageClient } from '@w3f/monitoring-types';
import { parse, stringify } from 'json-bigint';
import * as path from 'path';

/**
 * NOTE ON CONCURRENCY: node-persist writes one JSON file per key. Running multiple Node
 * processes that share the same directory will corrupt data because there's no file-level
 * locking. In case of horizontal scaling, switch back to Redis.
 */
@Injectable()
export class StorageService implements KeyValueStorageClient, OnModuleInit, OnModuleDestroy {
  private readonly storage: LocalStorage<any>;

  constructor(
    private namespace: string,
    private dataPath: string = 'data/node-persist',
  ) {
    this.storage = nodePersist.create();
  }

  async onModuleInit() {
    await this.storage.init({
      dir: path.join(process.cwd(), this.dataPath),
      stringify,
      parse,
    });
  }

  async onModuleDestroy() {
    // Ensures any pending writes finish
    await this.storage.persist();
  }

  private applyNamespace(key: string): string {
    return `${this.namespace}:${key}`;
  }

  async get<T>(key: string): Promise<T | null> {
    const namespacedKey = this.applyNamespace(key);
    const result = await this.storage.getItem(namespacedKey);
    return result === undefined ? null : result;
  }

  async set(key: string, value: any): Promise<void> {
    const namespacedKey = this.applyNamespace(key);
    await this.storage.setItem(namespacedKey, value);
  }

  async setex(key: string, seconds: number, value: any): Promise<void> {
    const namespacedKey = this.applyNamespace(key);
    await this.storage.setItem(namespacedKey, value, { ttl: seconds * 1000 });
  }

  async del(key: string): Promise<void> {
    const namespacedKey = this.applyNamespace(key);
    await this.storage.removeItem(namespacedKey);
  }

  async exists(key: string): Promise<boolean> {
    const namespacedKey = this.applyNamespace(key);
    // More efficient than full getItem
    return (await this.storage.valuesWithKeyMatch(namespacedKey)).length > 0;
  }

  /**
   * Gets multiple values by keys.
   * NOTE: This performs N separate get operations, so it's O(N) complexity.
   */
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    if (keys.length === 0) return [];
    const namespacedKeys = keys.map(key => this.applyNamespace(key));
    const values = await Promise.all(namespacedKeys.map(key => this.storage.getItem(key)));
    return values.map(value => (value === undefined ? null : value));
  }

  async flush(): Promise<void> {
    await this.storage.clear();
  }
}
