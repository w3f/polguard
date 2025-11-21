import { Incident, IncidentServiceInterface, QueryFilters } from '../../lib/interfaces';
import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '../config/config.service';
import { firstValueFrom } from 'rxjs';
import { MessengerType } from '@w3f/polguard-common';

@Injectable()
export class IncidentService implements IncidentServiceInterface {
  private readonly logger = new Logger(IncidentService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async getNonResolved(roomId: string): Promise<Incident[]> {
    const baseUrl = this.configService.getIncidentsUrl();
    const response = await firstValueFrom(
      this.httpService.get(baseUrl, {
        params: {
          channelId: roomId,
          messengerType: MessengerType.Matrix,
          isResolved: false,
        },
      }),
    );
    return response.data;
  }

  async getNonAcked(roomId: string): Promise<Incident[]> {
    const baseUrl = this.configService.getIncidentsUrl();
    const response = await firstValueFrom(
      this.httpService.get(baseUrl, {
        params: {
          channelId: roomId,
          messengerType: MessengerType.Matrix,
          needsAck: true,
          isAcked: false,
        },
      }),
    );
    return response.data;
  }

  async getIncidentById(incidentId: string): Promise<Incident> {
    const baseUrl = this.configService.getIncidentsUrl();
    const url = `${baseUrl}/${incidentId}`;
    const response = await firstValueFrom(this.httpService.get(url));
    return response.data;
  }

  async acknowledgeIncident(incidentId: string, username: string, channelId: string): Promise<void> {
    const baseUrl = this.configService.getIncidentsUrl();
    const url = `${baseUrl}/${incidentId}/acknowledge`;
    await firstValueFrom(
      this.httpService.post(url, {
        username,
        channelId,
      }),
    );
  }

  async resolveIncident(incidentId: string, username: string, channelId: string): Promise<void> {
    const baseUrl = this.configService.getIncidentsUrl();
    const url = `${baseUrl}/${incidentId}/resolve-manual`;
    await firstValueFrom(
      this.httpService.post(url, {
        username,
        channelId,
      }),
    );
  }

  async queryIncidents(roomId: string, filters: QueryFilters): Promise<Incident[]> {
    const baseUrl = this.configService.getIncidentsUrl();

    const params = {
      channelId: roomId,
      messengerType: MessengerType.Matrix,
      ...filters,
    };

    const response = await firstValueFrom(this.httpService.get(baseUrl, { params }));
    return response.data;
  }
}
