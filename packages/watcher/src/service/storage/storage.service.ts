import { Injectable, Inject } from '@nestjs/common';
import Redis from 'ioredis';
import { KeyValueStorageClient } from '@w3f/monitoring-types';

@Injectable()
export class StorageService implements KeyValueStorageClient {
  constructor(@Inject('REDIS_CLIENT') private readonly client: Redis) {}

  private serialize(value: any): string {
    return JSON.stringify(value, (_, value) => {
      if (typeof value === 'bigint') {
        return { __type: 'bigint', value: value.toString() };
      }
      return value;
    });
  }

  private deserialize(value: string): any {
    return JSON.parse(value, (_, value) => {
      if (value && typeof value === 'object' && value.__type === 'bigint') {
        return BigInt(value.value);
      }
      return value;
    });
  }

  async get<T>(key: string): Promise<T | null> {
    const value = await this.client.get(key);
    if (value === null) {
      return null;
    }
    return this.deserialize(value) as T;
  }

  async set(key: string, value: any): Promise<void> {
    await this.client.set(key, this.serialize(value));
  }

  async setex(key: string, seconds: number, value: any): Promise<void> {
    await this.client.setex(key, seconds, this.serialize(value));
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    const exists = await this.client.exists(key);
    return !!exists;
  }

  async keys(pattern: string): Promise<string[]> {
    return await this.client.keys(pattern);
  }

  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    if (keys.length === 0) return [];
    const values = await this.client.mget(keys);
    return values.map(value => (value ? (this.deserialize(value) as T) : null));
  }
}
