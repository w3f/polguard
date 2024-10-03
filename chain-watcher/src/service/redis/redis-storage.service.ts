import { Injectable, Inject } from '@nestjs/common';
import Redis from 'ioredis';
import { StorageClient } from '@lib/interfaces';

@Injectable()
export class RedisStorageService implements StorageClient {
  constructor(@Inject('REDIS_CLIENT') private readonly client: Redis) {}

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string): Promise<void> {
    await this.client.set(key, value);
  }

  async setex(key: string, ttl: number, value: string): Promise<void> {
    await this.client.setex(key, ttl, value);
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }
}
