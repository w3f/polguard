import { createHash } from 'crypto';
import {
  Logger,
  AlertSettings,
  DataStoreClient,
  IncidentHandlerClient,
  Chain,
  IncidentApiClient,
  CreateIncidentDto,
  ResolveIncidentDto,
  IncidentKey,
} from '@w3f/monitoring-types';

/**
 * IncidentHandler is responsible for managing and sending incidents to the incident management service.
 * It handles both ongoing incidents and one-time incidents.
 *
 * Key features:
 * - Uses a simple exists/doesn't exist approach to track incident state.
 * - Creates an incident when a condition starts firing (and wasn't firing before).
 * - Resolves an incident when a condition stops firing.
 * - Handles one-time incidents.
 */
export class IncidentHandler implements IncidentHandlerClient {
  constructor(
    private logger: Logger,
    private store: DataStoreClient,
    private incidentApi: IncidentApiClient,
    private chain: Chain,
  ) {}

  async ongoingIncident(
    message: string[],
    alerts: AlertSettings,
    isFiring: boolean,
    incidentKey: IncidentKey,
    blockNumber: number,
  ): Promise<void> {
    const incidentKeyStr = `inc:${incidentKey.wallet}:${incidentKey.groupId}:${incidentKey.handler}`;
    const incidentId = this.getIncidentId(incidentKeyStr);

    // Check if an incident is already active
    const exists = await this.store.exists(incidentId);

    if (isFiring && !exists) {
      // Create new incident if firing and no active incident
      await this.createIncident(message, alerts, incidentKey, blockNumber, false);

      // Just store a simple value "1" to indicate it's active
      await this.store.set(incidentId, 1);
    } else if (!isFiring && exists) {
      // Resolve incident if not firing and incident is active
      await this.resolveIncident(incidentKey);
      await this.store.del(incidentId);
    }
  }

  async oneTimeIncident(
    message: string[],
    alerts: AlertSettings,
    incidentKey: IncidentKey,
    blockNumber: number,
  ): Promise<void> {
    await this.createIncident(
      message,
      alerts,
      incidentKey,
      blockNumber,
      true, // One-time incidents are resolved immediately
    );
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

  // This is only used internally by the watcher
  private getIncidentId(incidentKey: string): string {
    return createHash('md5').update(incidentKey).digest('hex').substring(0, 16);
  }
}
