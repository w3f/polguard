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
    try {
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
    } catch (error) {
      this.logger.error(`Failed to fetch non-resolved incidents: ${error.message}`);
      throw new Error(`Failed to fetch non-resolved incidents: ${error.message}`);
    }
  }

  async getNonAcked(roomId: string): Promise<Incident[]> {
    try {
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
    } catch (error) {
      this.logger.error(`Failed to fetch non-acknowledged incidents: ${error.message}`);
      throw new Error(`Failed to fetch non-acknowledged incidents: ${error.message}`);
    }
  }

  async getIncidentById(incidentId: number): Promise<Incident> {
    try {
      const { baseUrl, endpoints } = this.configService.getMonitoringApi();
      const url = `${baseUrl}${endpoints.getIncident.replace(':id', incidentId.toString())}`;
      const response = await firstValueFrom(this.httpService.get(url));
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to fetch incident details: ${error.message}`);
      throw new Error(`Failed to fetch incident details: ${error.message}`);
    }
  }

  async acknowledgeIncident(incidentId: number, username: string, channelId: string): Promise<void> {
    try {
      const { baseUrl, endpoints } = this.configService.getMonitoringApi();
      const url = `${baseUrl}${endpoints.acknowledgeIncident.replace(':id', incidentId.toString())}`;
      await firstValueFrom(
        this.httpService.post(url, {
          username,
          channelId,
        }),
      );
    } catch (error) {
      this.logger.error(`Failed to acknowledge incident: ${error.message}`);
      throw new Error(`Failed to acknowledge incident: ${error.message}`);
    }
  }
}
