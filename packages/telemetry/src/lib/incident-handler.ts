import { createHash } from 'crypto';
import {
  Logger,
  NotificationSettings,
  KeyValueStorageClient,
  IncidentHandlerClient,
  Chain,
  IncidentApiClient,
  CreateIncidentDto,
  IncidentKey,
  NotificationChannel,
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
    notifications: NotificationSettings,
    incidentKey: IncidentKey,
    blockNumber: number,
    isFiring?: boolean,
  ): Promise<void> {
    // One-time incident (created as immediately resolved)
    if (isFiring === undefined) {
      await this.createIncident(message, notifications, incidentKey, blockNumber, true);
      return;
    }

    // Ongoing incident
    const storeKey = this.getStoreKey(incidentKey);
    const incidentId = await this.store.get<number>(storeKey);

    if (isFiring && !incidentId) {
      const id = await this.createIncident(message, notifications, incidentKey, blockNumber, false);
      await this.store.set(storeKey, id);
    } else if (!isFiring && incidentId) {
      await this.resolveIncident(incidentId);
      await this.store.del(storeKey);
    }
  }

  private async createIncident(
    message: string[],
    notifications: NotificationSettings,
    incidentKey: IncidentKey,
    blockNumber: number,
    isResolved: boolean = false,
  ): Promise<number> {
    // Create notification channels from notification settings
    const notificationChannels: NotificationChannel[] = notifications.channels.map(channel => ({
      channelId: channel,
      messengerType: notifications.messengerType,
      repeatHours: notifications.repeatHours,
    }));

    // Create the incident DTO according to CreateIncidentDto
    const createIncidentDto: CreateIncidentDto = {
      message: message.join('\n'),
      chain: this.chain,
      blockNumber,
      // Required fields
      account: incidentKey.account,
      groupId: incidentKey.groupId,
      handlerType: incidentKey.handlerType,
      // Notification channels
      notificationChannels,
      // Optional fields
      needsAck: notifications.needsAck || false,
      isResolved,
    };

    this.logger.debug(`Creating incident: ${JSON.stringify(createIncidentDto)}`);

    try {
      const incidentId = await this.incidentApi.createIncident(createIncidentDto);
      this.logger.debug(`Created incident with ID: ${incidentId}`);
      return incidentId;
    } catch (error) {
      this.logger.error(`Failed to create incident: ${error.message}`);
      throw new Error(`Failed to create incident: ${error.message}`);
    }
  }

  private async resolveIncident(incidentId: number): Promise<void> {
    this.logger.debug(`Resolving incident with ID: ${incidentId}`);

    try {
      await this.incidentApi.resolveIncident(incidentId);
    } catch (error) {
      this.logger.error(`Failed to resolve incident: ${error.message}`);
      throw new Error(`Failed to resolve incident: ${error.message}`);
    }
  }

  private getStoreKey(incidentKey: IncidentKey): string {
    const key = `${incidentKey.account}:${incidentKey.groupId}:${incidentKey.handlerType}`;
    const hash = createHash('md5').update(key).digest('hex').substring(0, 16);
    return `inc:${hash}`;
  }
}
