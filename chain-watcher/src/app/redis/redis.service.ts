import { Injectable, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { RedisClient } from '@core/interfaces';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class RedisService implements RedisClient {
  constructor(
    @Inject('REDIS_CLIENT')
    private readonly redisClient: ClientProxy
  ) {}

  async set(key: string, value: string): Promise<void> {
    await lastValueFrom(this.redisClient.send('set', [key, value]));
  }

  async setex(key: string, ttl: number, value: string): Promise<void> {
    await lastValueFrom(this.redisClient.send('setex', [key, ttl, value]));
  }

  async get(key: string): Promise<string | null> {
    return lastValueFrom(this.redisClient.send('get', key));
  }

  async del(key: string): Promise<void> {
    await lastValueFrom(this.redisClient.send('del', key));
  }

  async publish(channel: string, message: string): Promise<void> {
    await lastValueFrom(this.redisClient.send('publish', [channel, message]));
  }
}
