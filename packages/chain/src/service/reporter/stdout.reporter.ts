import type { AppLogger } from '@w3f/polguard-common';
import { IncidentReporter, CreateIncidentBody, ResolveByChainBody, IncidentContent } from '../../types';

/**
 * StdoutIncidentReporter: Outputs incidents directly to stdout
 *
 * Purpose:
 * - Zero-dependency local development and debugging
 * - Standalone chain service operation without API backend
 * - Easy integration with log aggregation tools
 */
export class StdoutIncidentReporter implements IncidentReporter {
  constructor(
    private readonly logger: AppLogger,
    private readonly format: 'json' | 'pretty' = 'pretty',
  ) {}

  async createIncident(dto: CreateIncidentBody): Promise<string | null> {
    if (this.format === 'pretty') {
      this.logPrettyCreate(dto);
    } else {
      this.logJsonCreate(dto);
    }
    return dto.idempotencyKey; // Return idempotency key for incident lifecycle tracking
  }

  async resolveIncident(id: string, data: ResolveByChainBody): Promise<void> {
    if (this.format === 'pretty') {
      this.logPrettyResolve(id, data);
    } else {
      this.logJsonResolve(id, data);
    }
  }

  private logJsonCreate(dto: CreateIncidentBody): void {
    console.log(
      JSON.stringify({
        type: 'incident_created',
        timestamp: new Date().toISOString(),
        ...dto,
      }),
    );
  }

  private logJsonResolve(id: string, data: ResolveByChainBody): void {
    console.log(
      JSON.stringify({
        type: 'incident_resolved',
        timestamp: new Date().toISOString(),
        incidentId: id,
        ...data,
      }),
    );
  }

  private formatContent(content: IncidentContent): string[] {
    const subject = content.subject ? `${content.subject.name} (${content.subject.address})` : null;
    return [
      `Condition: ${content.condition}`,
      subject ? `Subject: ${subject}` : null,
      ...content.details.map(line => `  ${line}`),
    ].filter(Boolean) as string[];
  }

  private logPrettyCreate(dto: CreateIncidentBody): void {
    const lines = [
      '',
      'INCIDENT CREATED',
      `Chain: ${dto.chain}`,
      `Block: #${dto.blockNumber}`,
      dto.account ? `Account: ${dto.account}` : null,
      `Handler: ${dto.handlerType}`,
      `Group: ${dto.groupId}`,
      ...this.formatContent(dto.content),
      '─'.repeat(50),
      '',
    ].filter(Boolean);

    console.log(lines.join('\n'));
  }

  private logPrettyResolve(id: string, data: ResolveByChainBody): void {
    const lines = [
      '',
      'INCIDENT RESOLVED',
      `Incident ID: ${id}`,
      `Chain: ${data.chain}`,
      `Block: #${data.blockNumber}`,
      ...this.formatContent(data.content),
      '─'.repeat(50),
      '',
    ];

    console.log(lines.join('\n'));
  }
}
