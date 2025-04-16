import { createHash } from 'crypto';
import {
  Logger,
  AlertSettings,
  KeyValueStorageClient,
  IncidentHandlerClient,
  Chain,
  IncidentApiClient,
  CreateIncidentDto,
  ResolveIncidentDto,
  IncidentKey,
} from '@w3f/monitoring-types';

/**
 * IncidentHandler is responsible for managing and sending incidents to the monitoring service.
 * It handles both ongoing incidents and one-time incidents.
 *
 * Key features:
 * - Tracks incident state.
 * - Creates an incident when a condition starts firing (and wasn't firing before).
 * - Resolves an incident when a condition stops firing.
 * - Handles one-time incidents.
 */
export class IncidentHandler implements IncidentHandlerClient {
  constructor(
    private logger: Logger,
    private store: KeyValueStorageClient,
    private incidentApi: IncidentApiClient,
    private chain: Chain,
  ) {}

  async handle(
    message: string[],
    alerts: AlertSettings,
    incidentKey: IncidentKey,
    blockNumber: number,
    isFiring?: boolean,
  ): Promise<void> {
    // One-time incident (created as immediately resolved)
    if (isFiring === undefined) {
      await this.createIncident(message, alerts, incidentKey, blockNumber, true);
      return;
    }

    // Ongoing incident
    const incidentId = this.getIncidentId(incidentKey);
    const exists = await this.store.exists(incidentId);

    if (isFiring && !exists) {
      await this.createIncident(message, alerts, incidentKey, blockNumber, false);
      await this.store.set(incidentId, 1);
    } else if (!isFiring && exists) {
      await this.resolveIncident(incidentKey);
      await this.store.del(incidentId);
    }
  }

  private async createIncident(
    message: string[],
    alerts: AlertSettings,
    incidentKey: IncidentKey,
    blockNumber: number,
    resolved: boolean = false,
  ): Promise<void> {
    // Create the incident DTO according to CreateIncidentDto
    const createIncidentDto: CreateIncidentDto = {
      message: message.join('\n'),
      chain: this.chain,
      blockNumber,
      // Required fields
      wallet: incidentKey.wallet,
      groupId: incidentKey.groupId,
      handler: incidentKey.handler,
      // From alerts
      channelId: alerts.targets[0],
      messengerType: alerts.messengerType,
      // Optional fields
      ackRequired: alerts.acknowledgement || false,
      repeatIntervalHours: alerts.repeatIntervalHours,
      resolved: resolved,
    };

    this.logger.debug(`Creating incident: ${JSON.stringify(createIncidentDto)}`);

    try {
      await this.incidentApi.createIncident(createIncidentDto);
    } catch (error) {
      this.logger.error(`Failed to create incident: ${error.message}`);
      throw new Error(`Failed to create incident: ${error.message}`);
    }
  }

  private async resolveIncident(incidentKey: IncidentKey): Promise<void> {
    const resolveIncidentDto: ResolveIncidentDto = {
      chain: this.chain,
      groupId: incidentKey.groupId,
      handler: incidentKey.handler,
      wallet: incidentKey.wallet,
    };

    this.logger.debug(`Resolving incident for ${incidentKey.wallet} in group ${incidentKey.groupId}`);

    try {
      await this.incidentApi.resolveIncident(resolveIncidentDto);
    } catch (error) {
      this.logger.error(`Failed to resolve incident: ${error.message}`);
      throw new Error(`Failed to resolve incident: ${error.message}`);
    }
  }

  private getIncidentId(incidentKey: IncidentKey): string {
    const key = `${incidentKey.wallet}:${incidentKey.groupId}:${incidentKey.handler}`;
    const hash = createHash('md5').update(key).digest('hex').substring(0, 16);
    return `inc:${hash}`;
  }
}
