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
      if (id) {
        await this.store.set(storeKey, id);
      }
    } else if (!isFiring && incidentId) {
      await this.resolveIncident(incidentId, blockNumber);
      await this.store.del(storeKey);
    }
  }

  private async createIncident(
    message: string[],
    notifications: NotificationSettings,
    incidentKey: IncidentKey,
    blockNumber: number,
    isResolved: boolean = false,
  ): Promise<string | null> {
    const { channels, escalationChannels, escalationTimeoutMs, messengerType, repeatFiringMs } = notifications;

    const createIncidentDto: CreateIncidentDto = {
      message: message.join('\n'),
      chain: this.chain,
      blockNumber,
      // Required fields
      account: incidentKey.account,
      groupId: incidentKey.groupId,
      handlerType: incidentKey.handlerType,
      idempotencyKey: this.getStoreKey(incidentKey),
      notificationChannels: channels.map(channelId => ({ channelId, messengerType, repeatFiringMs })),
      // Optional fields
      escalationChannels: escalationChannels.map(channelId => ({ channelId, messengerType })),
      escalationTimeoutMs,
      needsAck: notifications.needsAck || false,
      isResolved,
    };

    this.logger.debug(`Sending incident: ${JSON.stringify(createIncidentDto)}`);

    const incidentId = await this.incidentApi.createIncident(createIncidentDto);
    if (incidentId) {
      this.logger.debug(`Sent incident with ID: ${incidentId}`);
    } else {
      this.logger.debug('Skipping incident.');
    }
    return incidentId;
  }

  private async resolveIncident(incidentId: number, blockNumber: number): Promise<void> {
    this.logger.debug(`Resolving incident with ID: ${incidentId}`);
    await this.incidentApi.resolveIncident(incidentId, { chain: this.chain, blockNumber });
  }

  private getStoreKey(incidentKey: IncidentKey): string {
    const { account, groupId, handlerType, token } = incidentKey;
    const key = `${account}:${groupId}:${handlerType}:${token || 'none'}`;
    const hash = createHash('md5').update(key).digest('hex').substring(0, 16);
    return `inc:${hash}`;
  }
}
