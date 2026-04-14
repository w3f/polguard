import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { IncidentReporter, CreateIncidentDto, ResolveIncidentByChainDto } from '../../types';
import { ConfigService } from '../config/config.service';
import { lastValueFrom, timeout } from 'rxjs';

/**
 * IncidentServiceReporter: Sends incidents to the centralized Incident Service (API)
 *
 * Purpose:
 * - Managed production deployments with centralized incident management
 * - Persistent incident storage in PostgreSQL via Incident service
 * - Notification delivery through Matrix service
 */
@Injectable()
export class IncidentServiceReporter implements IncidentReporter {
  private readonly baseUrl: string;
  private readonly timeoutMs = 5000;

  constructor(
    private readonly logger: Logger,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    const config = this.configService.getIncidentReporterConfig();
    this.baseUrl = config.service!.url;
  }

  async createIncident(incident: CreateIncidentDto): Promise<string | null> {
    try {
      const response = await lastValueFrom(this.httpService.post(this.baseUrl, incident).pipe(timeout(this.timeoutMs)));

      if (response.status >= 200 && response.status < 300) {
        return response.data.id;
      }
      return null;
    } catch (error) {
      if (error.response?.status === 409) {
        this.logger.debug(`Block ${incident.blockNumber} has been already processed, skipping.`);
        return null;
      }

      this.logger.error(`Failed to create incident: ${error.message}`);
      throw error;
    }
  }

  async resolveIncident(id: string, resolveData: ResolveIncidentByChainDto): Promise<void> {
    try {
      const url = `${this.baseUrl}/${id}/resolve`;
      const response = await lastValueFrom(this.httpService.post(url, resolveData).pipe(timeout(this.timeoutMs)));

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
