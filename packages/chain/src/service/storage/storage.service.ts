import { Injectable } from '@nestjs/common';
import Keyv from 'keyv';
import { KeyValueStorageClient } from '@w3f/monitoring-types';
import { parse, stringify } from 'json-bigint';

@Injectable()
export class StorageService implements KeyValueStorageClient {
  private readonly storage: Keyv;

  constructor(private namespace: string) {
    this.storage = new Keyv({
      namespace: this.namespace,
      serialize: stringify,
      deserialize: parse,
    });
  }

  async get<T>(key: string): Promise<T | null> {
    const result = await this.storage.get(key);
    return result === undefined ? null : result;
  }

  async set(key: string, value: any): Promise<void> {
    await this.storage.set(key, value);
  }

  async setex(key: string, seconds: number, value: any): Promise<void> {
    await this.storage.set(key, value, seconds * 1000);
  }

  async del(key: string): Promise<void> {
    await this.storage.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    return this.storage.has(key);
  }

  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    if (keys.length === 0) return [];
    const values = await this.storage.get(keys);
    return values.map(value => (value === undefined ? null : value));
  }

  async flush(): Promise<void> {
    await this.storage.clear();
  }
}
