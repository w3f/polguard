import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { IncidentReporter, CreateIncidentDto, ResolveIncidentByChainDto } from '@w3f/polguard-common';
import { ConfigService } from '../config/config.service';
import { lastValueFrom, timeout } from 'rxjs';

/**
 * WebhookIncidentReporter: Sends incidents to a generic HTTP webhook endpoint
 *
 * Purpose:
 * - Integration with external monitoring/alerting systems
 * - Custom incident processing pipelines
 * - Development/testing with local webhook receivers
 */
@Injectable()
export class WebhookIncidentReporter implements IncidentReporter {
  private readonly url: string;
  private readonly headers: Record<string, string>;
  private readonly timeoutMs = 5000;

  constructor(
    private readonly logger: Logger,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    const config = this.configService.getIncidentReporterConfig();
    this.url = config.webhook!.url;
    this.headers = config.webhook!.headers ?? {};
  }

  async createIncident(incident: CreateIncidentDto): Promise<string | null> {
    try {
      const payload = {
        type: 'incident_created',
        timestamp: new Date().toISOString(),
        ...incident,
      };

      await lastValueFrom(
        this.httpService.post(this.url, payload, { headers: this.headers }).pipe(timeout(this.timeoutMs)),
      );

      this.logger.debug(`Webhook incident created for block ${incident.blockNumber}`);
    } catch (error) {
      // Log as warning, don't throw - webhook failures shouldn't break monitoring
      this.logger.warn(`Failed to send incident to webhook: ${error.message}`);
    }

    return incident.idempotencyKey; // Return idempotency key for incident lifecycle tracking
  }

  async resolveIncident(id: string, resolveData: ResolveIncidentByChainDto): Promise<void> {
    try {
      const payload = {
        type: 'incident_resolved',
        timestamp: new Date().toISOString(),
        incidentId: id,
        ...resolveData,
      };

      await lastValueFrom(
        this.httpService.post(this.url, payload, { headers: this.headers }).pipe(timeout(this.timeoutMs)),
      );

      this.logger.debug(`Webhook incident resolved: ${id}`);
    } catch (error) {
      this.logger.warn(`Failed to send resolution to webhook: ${error.message}`);
    }
  }
}
