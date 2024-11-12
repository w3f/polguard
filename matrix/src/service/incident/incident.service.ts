import { Incident, IncidentServiceInterface } from '@lib/interfaces';
import { Injectable } from '@nestjs/common';
import { RedisStreamsClient } from '@w3f/nest-redis-streams';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class IncidentService implements IncidentServiceInterface {
  constructor(private readonly client: RedisStreamsClient) {}

  async getNonAckedIncidentsForRoom(roomId: string): Promise<Incident[]> {
    try {
      return await lastValueFrom(this.client.send<Incident[]>('get_non_acked_incidents', { roomId }));
    } catch {
      throw new Error('Failed to fetch non-acknowledged incidents');
    }
  }
}
