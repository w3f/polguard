import { IncidentApiClient, CreateIncidentDto, ResolveIncidentByChainDto } from '@w3f/monitoring-types';
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

  async createIncident(incident: CreateIncidentDto): Promise<string | null> {
    try {
      const response = await lastValueFrom(this.httpService.post(this.createUrl, incident));

      if (response.status >= 200 && response.status < 300) {
        return response.data.id;
      }
    } catch (error) {
      if (error.response?.status === 409) {
        this.logger.debug(`Block ${incident.blockNumber} has been already processed, skipping.`);
        return;
      }

      this.logger.error(`Failed to create incident: ${error.message}`);
      throw error;
    }
  }

  async resolveIncident(id: number, resolveData: ResolveIncidentByChainDto): Promise<void> {
    try {
      const url = this.resolveUrl.replace(':id', id.toString());
      const response = await lastValueFrom(this.httpService.post(url, resolveData));

      if (response.status >= 200 && response.status < 300) {
        return;
      }
    } catch (error) {
      if (error.response?.status === 409) {
        this.logger.debug(`Block ${resolveData.blockNumber} has been already processed, skipping.`);
        return;
      }

      this.logger.error(`Failed to resolve incident ${id}: ${error.message}`);
      throw error;
    }
  }
}
