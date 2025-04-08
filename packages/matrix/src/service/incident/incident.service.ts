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
      const apiUrl = this.configService.getIncidentManagementUrl();
      const response = await firstValueFrom(
        this.httpService.get(`${apiUrl}/incidents`, {
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
      const apiUrl = this.configService.getIncidentManagementUrl();
      const response = await firstValueFrom(
        this.httpService.get(`${apiUrl}/incidents`, {
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
      const apiUrl = this.configService.getIncidentManagementUrl();
      const response = await firstValueFrom(this.httpService.get(`${apiUrl}/incidents/${incidentId}`));
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to fetch incident details: ${error.message}`);
      throw new Error(`Failed to fetch incident details: ${error.message}`);
    }
  }

  async acknowledgeIncident(incidentId: number, username: string, channelId: string): Promise<void> {
    try {
      const apiUrl = this.configService.getIncidentManagementUrl();
      await firstValueFrom(
        this.httpService.post(`${apiUrl}/incidents/${incidentId}/acknowledge`, {
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
