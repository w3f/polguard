import type { AppLogger } from '@w3f/polguard-common';
import { IncidentReporter, CreateIncidentDto, ResolveIncidentByChainDto } from '../../types';
import { ConfigService } from '../config/config.service';

/**
 * IncidentServiceReporter: Sends incidents to the centralized Incident Service (API)
 *
 * Purpose:
 * - Managed production deployments with centralized incident management
 * - Persistent incident storage in PostgreSQL via Incident service
 * - Notification delivery through Matrix service
 */
export class IncidentServiceReporter implements IncidentReporter {
  private readonly baseUrl: string;
  private readonly timeoutMs = 5000;

  constructor(
    private readonly logger: AppLogger,
    private readonly configService: ConfigService,
  ) {
    const config = this.configService.getIncidentReporterConfig();
    this.baseUrl = config.service!.url;
  }

  async createIncident(incident: CreateIncidentDto): Promise<string | null> {
    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(incident),
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (response.ok) {
        const data = await response.json();
        return data.id;
      }

      if (response.status === 409) {
        this.logger.debug(`Block ${incident.blockNumber} has been already processed, skipping.`);
        return null;
      }

      return null;
    } catch (error) {
      if ((error as any)?.cause?.code === 'ABORT_ERR') {
        this.logger.error(`Timeout creating incident for block ${incident.blockNumber}`);
        throw error;
      }

      this.logger.error(`Failed to create incident: ${(error as Error).message}`);
      throw error;
    }
  }

  async resolveIncident(id: string, resolveData: ResolveIncidentByChainDto): Promise<void> {
    try {
      const url = `${this.baseUrl}/${id}/resolve`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(resolveData),
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (response.ok) {
        return;
      }

      if (response.status === 409) {
        this.logger.debug(`Block ${resolveData.blockNumber} has been already processed, skipping.`);
        return;
      }
    } catch (error) {
      this.logger.error(`Failed to resolve incident ${id}: ${(error as Error).message}`);
      throw error;
    }
  }
}
