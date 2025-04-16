import { Injectable, Inject } from '@nestjs/common';
import Redis from 'ioredis';
import { KeyValueStorageClient } from '@w3f/monitoring-types';
import { ConfigService } from '../config/config.service';
import { parse, stringify } from 'json-bigint';

@Injectable()
export class StorageService implements KeyValueStorageClient {
  private readonly namespace: string;

  constructor(
    @Inject('REDIS_CLIENT') private readonly client: Redis,
    private readonly configService: ConfigService,
  ) {
    this.namespace = this.configService.getChain();
  }

  private applyNamespace(key: string): string {
    return `${this.namespace}:${key}`;
  }

  private serialize(value: any): string {
    return stringify(value);
  }

  private deserialize(value: string): any {
    return parse(value);
  }

  async get<T>(key: string): Promise<T | null> {
    const namespacedKey = this.applyNamespace(key);
    const value = await this.client.get(namespacedKey);
    if (value === null) {
      return null;
    }
    return this.deserialize(value) as T;
  }

  async set(key: string, value: any): Promise<void> {
    const namespacedKey = this.applyNamespace(key);
    await this.client.set(namespacedKey, this.serialize(value));
  }

  async setex(key: string, seconds: number, value: any): Promise<void> {
    const namespacedKey = this.applyNamespace(key);
    await this.client.setex(namespacedKey, seconds, this.serialize(value));
  }

  async del(key: string): Promise<void> {
    const namespacedKey = this.applyNamespace(key);
    await this.client.del(namespacedKey);
  }

  async exists(key: string): Promise<boolean> {
    const namespacedKey = this.applyNamespace(key);
    const exists = await this.client.exists(namespacedKey);
    return !!exists;
  }

  async keys(pattern: string): Promise<string[]> {
    const namespacedPattern = this.applyNamespace(pattern);
    return await this.client.keys(namespacedPattern);
  }

  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    if (keys.length === 0) return [];
    const namespacedKeys = keys.map(key => this.applyNamespace(key));
    const values = await this.client.mget(namespacedKeys);
    return values.map(value => (value ? (this.deserialize(value) as T) : null));
  }
}
