import { IncidentApiClient, CreateIncidentDto, ResolveIncidentDto } from '@w3f/monitoring-types';
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

  async createIncident(incident: CreateIncidentDto): Promise<boolean> {
    try {
      await lastValueFrom(this.httpService.post(this.createUrl, incident));
      return true;
    } catch (error) {
      this.logger.error(`Failed to create incident: ${error.message}`);
      throw new Error(`Failed to create incident: ${error.message}`);
    }
  }

  async resolveIncident(resolveData: ResolveIncidentDto): Promise<boolean> {
    try {
      await lastValueFrom(this.httpService.post(this.resolveUrl, resolveData));
      return true;
    } catch (error) {
      this.logger.error(`Failed to resolve incident: ${error.message}`);
      throw new Error(`Failed to resolve incident: ${error.message}`);
    }
  }
}
