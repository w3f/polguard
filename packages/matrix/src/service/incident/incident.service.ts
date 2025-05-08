import { Incident, IncidentServiceInterface } from '@lib/interfaces';
import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '../config/config.service';
import { firstValueFrom } from 'rxjs';

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
          resolved: false,
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
          ackRequired: true,
          acked: false,
        },
      }),
    );
    return response.data;
  }

  async getIncidentById(incidentId: number): Promise<Incident> {
    const { baseUrl, endpoints } = this.configService.getMonitoringApi();
    const url = `${baseUrl}${endpoints.getIncident.replace(':id', incidentId.toString())}`;
    const response = await firstValueFrom(this.httpService.get(url));
    return response.data;
  }

  async acknowledgeIncident(incidentId: number, username: string, channelId: string): Promise<void> {
    const { baseUrl, endpoints } = this.configService.getMonitoringApi();
    const url = `${baseUrl}${endpoints.acknowledgeIncident.replace(':id', incidentId.toString())}`;
    await firstValueFrom(
      this.httpService.post(url, {
        username,
        channelId,
      }),
    );
  }
}
