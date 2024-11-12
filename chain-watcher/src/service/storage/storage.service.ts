import { Injectable, Inject } from '@nestjs/common';
import Redis from 'ioredis';
import { KeyValueStorageClient } from '@lib/interfaces';

@Injectable()
export class StorageService implements KeyValueStorageClient {
  constructor(@Inject('REDIS_CLIENT') private readonly client: Redis) {}

  async get<T>(key: string): Promise<T | null> {
    const value = await this.client.get(key);
    if (value === null) {
      return null;
    }
    return JSON.parse(value) as T;
  }

  async set(key: string, value: any): Promise<void> {
    await this.client.set(key, JSON.stringify(value));
  }

  async setex(key: string, seconds: number, value: any): Promise<void> {
    await this.client.setex(key, seconds, JSON.stringify(value));
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async keys(pattern: string): Promise<string[]> {
    return await this.client.keys(pattern);
  }
}
