import { Injectable, Inject } from '@nestjs/common';
import Redis from 'ioredis';
import { MessageBroker } from '@lib/interfaces';

@Injectable()
export class RedisPubSubService implements MessageBroker {
  constructor(@Inject('REDIS_CLIENT') private readonly client: Redis) {}

  async publish(channel: string, message: string): Promise<void> {
    await this.client.publish(channel, message);
  }
}
