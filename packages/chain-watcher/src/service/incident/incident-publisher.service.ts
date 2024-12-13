import { EventEmitterClient } from '@lib/interfaces';
import { Injectable } from '@nestjs/common';
import { RedisStreamsClient } from '@w3f/nest-redis-streams';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class IncidentPublisherService implements EventEmitterClient {
  constructor(private readonly client: RedisStreamsClient) {}

  async emit(event: string, payload: any): Promise<boolean> {
    try {
      await lastValueFrom(this.client.emit(event, payload));
      return true;
    } catch (error) {
      throw new Error(`Failed to emit event: ${error}`);
    }
  }
}
