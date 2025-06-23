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

  async createIncident(incident: CreateIncidentDto): Promise<string> {
    const response = await lastValueFrom(this.httpService.post(this.createUrl, incident));
    return response.data.id;
  }

  async resolveIncident(id: number): Promise<boolean> {
    const url = this.resolveUrl.replace(':id', id.toString());
    await lastValueFrom(this.httpService.post(url, {}));
    return true;
  }
}
