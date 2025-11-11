import { Injectable, Logger } from '@nestjs/common';
import { IncidentReporter, CreateIncidentDto, ResolveIncidentByChainDto } from '@w3f/monitoring-common';

/**
 * StdoutIncidentReporter: Outputs incidents directly to stdout
 *
 * Purpose:
 * - Zero-dependency local development and debugging
 * - Standalone chain service operation without API backend
 * - Easy integration with log aggregation tools
 */
@Injectable()
export class StdoutIncidentReporter implements IncidentReporter {
  constructor(
    private readonly logger: Logger,
    private readonly format: 'json' | 'pretty' = 'json',
  ) {}

  async createIncident(dto: CreateIncidentDto): Promise<string | null> {
    if (this.format === 'pretty') {
      this.logPrettyCreate(dto);
    } else {
      this.logJsonCreate(dto);
    }
    return dto.idempotencyKey; // Return idempotency key for incident lifecycle tracking
  }

  async resolveIncident(id: string, data: ResolveIncidentByChainDto): Promise<void> {
    if (this.format === 'pretty') {
      this.logPrettyResolve(id, data);
    } else {
      this.logJsonResolve(id, data);
    }
  }

  private logJsonCreate(dto: CreateIncidentDto): void {
    console.log(
      JSON.stringify({
        type: 'incident_created',
        timestamp: new Date().toISOString(),
        ...dto,
      }),
    );
  }

  private logJsonResolve(id: string, data: ResolveIncidentByChainDto): void {
    console.log(
      JSON.stringify({
        type: 'incident_resolved',
        timestamp: new Date().toISOString(),
        incidentId: id,
        ...data,
      }),
    );
  }

  private logPrettyCreate(dto: CreateIncidentDto): void {
    const lines = [
      '',
      '🔔 INCIDENT CREATED',
      `Chain: ${dto.chain}`,
      `Block: #${dto.blockNumber}`,
      dto.account ? `Account: ${dto.account}` : null,
      `Handler: ${dto.handlerType}`,
      `Group: ${dto.groupId}`,
      'Message:',
      ...dto.message.split('\n').map(line => `  ${line}`),
      `Idempotency: ${dto.idempotencyKey}`,
      '─'.repeat(50),
      '',
    ].filter(Boolean);

    console.log(lines.join('\n'));
  }

  private logPrettyResolve(id: string, data: ResolveIncidentByChainDto): void {
    const lines = [
      '',
      '✅ INCIDENT RESOLVED',
      `Incident ID: ${id}`,
      `Chain: ${data.chain}`,
      `Block: #${data.blockNumber}`,
      'Resolution:',
      ...data.resolutionMessage.split('\n').map(line => `  ${line}`),
      '─'.repeat(50),
      '',
    ];

    console.log(lines.join('\n'));
  }
}
