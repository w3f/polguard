import { Incident, IncidentServiceInterface, QueryFilters } from '../../lib/interfaces';
import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '../config/config.service';
import { firstValueFrom } from 'rxjs';
import { MessengerType } from '@w3f/monitoring-types';

@Injectable()
export class IncidentService implements IncidentServiceInterface {
  private readonly logger = new Logger(IncidentService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async getNonResolved(roomId: string): Promise<Incident[]> {
    const { baseUrl, endpoints } = this.configService.getMonitoringApi();
    const url = `${baseUrl}${endpoints.getIncidents}`;
    const response = await firstValueFrom(
      this.httpService.get(url, {
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
    const { baseUrl, endpoints } = this.configService.getMonitoringApi();
    const url = `${baseUrl}${endpoints.getIncidents}`;
    const response = await firstValueFrom(
      this.httpService.get(url, {
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
    const { baseUrl, endpoints } = this.configService.getMonitoringApi();
    const url = `${baseUrl}${endpoints.getIncident.replace(':id', incidentId)}`;
    const response = await firstValueFrom(this.httpService.get(url));
    return response.data;
  }

  async acknowledgeIncident(incidentId: string, username: string, channelId: string): Promise<void> {
    const { baseUrl, endpoints } = this.configService.getMonitoringApi();
    const url = `${baseUrl}${endpoints.acknowledgeIncident.replace(':id', incidentId)}`;
    await firstValueFrom(
      this.httpService.post(url, {
        username,
        channelId,
      }),
    );
  }

  async resolveIncident(incidentId: string, username: string, channelId: string): Promise<void> {
    const { baseUrl, endpoints } = this.configService.getMonitoringApi();
    const url = `${baseUrl}${endpoints.resolveIncidentManually.replace(':id', incidentId)}`;
    await firstValueFrom(
      this.httpService.post(url, {
        username,
        channelId,
      }),
    );
  }

  async queryIncidents(roomId: string, filters: QueryFilters): Promise<Incident[]> {
    const { baseUrl, endpoints } = this.configService.getMonitoringApi();
    const url = `${baseUrl}${endpoints.getIncidents}`;

    const params = {
      channelId: roomId,
      messengerType: MessengerType.Matrix,
      ...filters,
    };

    const response = await firstValueFrom(this.httpService.get(url, { params }));
    return response.data;
  }
}
