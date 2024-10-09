import { Incident, IncidentServiceInterface } from '@lib/interfaces';
import { Injectable, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class IncidentService implements IncidentServiceInterface {

  constructor(@Inject('REDIS_PROXY_CLIENT') private readonly client: ClientProxy) {}

  async getNonAckedIncidentsForRoom(roomId: string): Promise<Incident[]> {
    try {
      return await firstValueFrom(
        this.client.send<Incident[]>({ cmd: 'get_non_acked_incidents' }, { roomId })
      );
    } catch (error) {
      throw new Error('Failed to fetch non-acknowledged incidents');
    }
  }
}
