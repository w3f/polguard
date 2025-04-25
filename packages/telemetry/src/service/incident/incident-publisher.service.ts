import { IncidentApiClient, CreateIncidentDto } from '@w3f/monitoring-types';
import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '../config/config.service';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class IncidentApiService implements IncidentApiClient {
  private readonly createUrl: string;
  private readonly resolveUrl: string;

  constructor(
    private readonly logger: Logger,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    const monitoringApi = this.configService.getMonitoringApi();
    const { baseUrl, endpoints } = monitoringApi;
    this.createUrl = `${baseUrl}${endpoints.createIncident}`;
    this.resolveUrl = `${baseUrl}${endpoints.resolveIncident}`;
  }

  async createIncident(incident: CreateIncidentDto): Promise<number> {
    try {
      const response = await lastValueFrom(this.httpService.post(this.createUrl, incident));
      return response.data.id;
    } catch (error) {
      this.logger.error(`Failed to create incident: ${error.message}`);
      throw new Error(`Failed to create incident: ${error.message}`);
    }
  }

  async resolveIncident(id: number): Promise<boolean> {
    try {
      const url = this.resolveUrl.replace(':id', id.toString());
      await lastValueFrom(this.httpService.post(url, {}));
      return true;
    } catch (error) {
      this.logger.error(`Failed to resolve incident: ${error.message}`);
      throw new Error(`Failed to resolve incident: ${error.message}`);
    }
  }
}
