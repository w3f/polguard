import type { AppLogger } from '@w3f/polguard-common';
import { IncidentReporter, CreateIncidentBody, ResolveByChainBody } from '../../types';
import { ConfigService } from '../config/config.service';

/**
 * WebhookIncidentReporter: Sends incidents to a generic HTTP webhook endpoint
 *
 * Purpose:
 * - Integration with external monitoring/alerting systems
 * - Custom incident processing pipelines
 * - Development/testing with local webhook receivers
 */
export class WebhookIncidentReporter implements IncidentReporter {
  private readonly url: string;
  private readonly headers: Record<string, string>;
  private readonly timeoutMs = 5000;

  constructor(
    private readonly logger: AppLogger,
    private readonly configService: ConfigService,
  ) {
    const config = this.configService.getIncidentReporterConfig();
    this.url = config.webhook!.url;
    this.headers = config.webhook!.headers ?? {};
  }

  async createIncident(incident: CreateIncidentBody): Promise<string> {
    await this.post(
      { type: 'incident_created', timestamp: new Date().toISOString(), ...incident },
      `create incident for block ${incident.blockNumber}`,
    );

    this.logger.debug(`Webhook incident created for block ${incident.blockNumber}`);
    return incident.idempotencyKey; // No server-assigned id: the idempotency key tracks the lifecycle
  }

  async resolveIncident(id: string, resolveData: ResolveByChainBody): Promise<void> {
    await this.post(
      { type: 'incident_resolved', timestamp: new Date().toISOString(), incidentId: id, ...resolveData },
      `resolve incident ${id}`,
    );

    this.logger.debug(`Webhook incident resolved: ${id}`);
  }

  private async post(payload: unknown, action: string): Promise<void> {
    let response: Response;

    try {
      response = await fetch(this.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...this.headers },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      throw new Error(`Webhook failed to ${action}: ${(error as Error).message}`, { cause: error });
    }

    if (!response.ok) {
      throw new Error(`Webhook failed to ${action}: HTTP ${response.status}`);
    }
  }
}
