import { EventEmitterClient } from '@lib/interfaces';
import { Injectable, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

@Injectable()
export class EventEmitterService implements EventEmitterClient {

  constructor(@Inject('REDIS_PROXY_CLIENT') private readonly client: ClientProxy) {}

  emit(event: string, payload: any): boolean {
    try {
      this.client.emit({ cmd: event }, payload);
      return true;
    } catch (error) {
      console.error('Failed to emit event', error);
      return false;
    }
  }
}
