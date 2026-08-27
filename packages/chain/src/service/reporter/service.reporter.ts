import type { AppLogger } from '@w3f/polguard-common';
import { IncidentReporter, CreateIncidentBody, ResolveByChainBody } from '../../types';
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
  private readonly timeoutMs = 15000;

  constructor(
    private readonly logger: AppLogger,
    private readonly configService: ConfigService,
  ) {
    const config = this.configService.getIncidentReporterConfig();
    this.baseUrl = config.service!.url;
  }

  async createIncident(incident: CreateIncidentBody): Promise<string> {
    const action = `create incident for block ${incident.blockNumber}`;
    const response = await this.post(this.baseUrl, incident, action);

    if (!response.ok) {
      throw new Error(`Failed to ${action}: HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.id;
  }

  async resolveIncident(id: string, resolveData: ResolveByChainBody): Promise<void> {
    const action = `resolve incident ${id}`;
    const response = await this.post(`${this.baseUrl}/${id}/resolve`, resolveData, action);

    if (response.ok) {
      return;
    }

    if (response.status === 404) {
      this.logger.warn(`Incident ${id} no longer exists, dropping it.`);
      return;
    }

    throw new Error(`Failed to ${action}: HTTP ${response.status}`);
  }

  private async post(url: string, body: unknown, action: string): Promise<Response> {
    try {
      return await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      throw new Error(`Failed to ${action}: ${(error as Error).message}`, { cause: error });
    }
  }
}
