import { createHash } from 'crypto';
import {
  Logger,
  NotificationSettings,
  Store,
  IncidentHandlerClient,
  Chain,
  IncidentReporter,
  CreateIncidentDto,
  IncidentKey,
  BlockContext,
} from '@w3f/monitoring-types';

/**
 * Build a unified idempotency key for both ongoing & one-time incidents.
 * Rule:
 * - Base = chain + (groupId, handlerType, account?, token?)
 * - Ongoing (no indexes): key = hash(Base)
 * - One-time (event):     key = hash(Base + block + eventIdx)
 * - One-time (call):      key = hash(Base + block + extrinsicIdx + callIdx)
 *
 * This same key is also used as the KV store key for ongoing lifecycle.
 */
function md5_16(parts: unknown[]): string {
  return createHash('md5').update(JSON.stringify(parts)).digest('hex').slice(0, 16);
}

function buildIdempotencyKey(chain: Chain, ik: IncidentKey, ctx: BlockContext): string {
  const base: unknown[] = [chain, ik.groupId, ik.handlerType, ik.account ?? null, ik.token ?? null];

  const isEvent = ctx.eventIdx !== undefined;
  const isCall = ctx.extrinsicIdx !== undefined && ctx.callIdx !== undefined;

  // Ongoing/state: stable across blocks (no blockNumber in key)
  if (!isEvent && !isCall) {
    return `inc:${md5_16(base)}`;
  }

  // One-time (event)
  if (isEvent) {
    return `inc:${md5_16([...base, ctx.blockNumber, 'ev', ctx.eventIdx])}`;
  }

  // One-time (call leaf)
  return `inc:${md5_16([...base, ctx.blockNumber, 'ex', ctx.extrinsicIdx, 'call', ctx.callIdx])}`;
}

/**
 * IncidentHandler is responsible for managing and sending incidents to the monitoring service.
 * It handles both ongoing incidents and one-time incidents.
 *
 * Key features:
 * - Tracks incident state using Store's KV operations
 * - Creates an incident when a condition starts firing (and wasn't firing before)
 * - Resolves an incident when a condition stops firing
 * - Handles one-time incidents
 */
export class IncidentHandler implements IncidentHandlerClient {
  constructor(
    private logger: Logger,
    private store: Store,
    private reporter: IncidentReporter,
    private chain: Chain,
  ) {}

  async handle(
    message: string[],
    notifications: NotificationSettings,
    incidentKey: IncidentKey,
    blockContext: BlockContext,
    isFiring?: boolean,
  ): Promise<void> {
    // Compute the unified key once; use it for both API idempotency and KV store (ongoing).
    const idempotencyKey = buildIdempotencyKey(this.chain, incidentKey, blockContext);

    // One-time incident (created as immediately resolved)
    if (isFiring === undefined) {
      await this.createIncident(message, notifications, incidentKey, blockContext, true, idempotencyKey);
      return;
    }

    // Ongoing incident lifecycle
    const incidentId = await this.store.get<string>(idempotencyKey);

    if (isFiring && !incidentId) {
      const id = await this.createIncident(message, notifications, incidentKey, blockContext, false, idempotencyKey);
      if (id) {
        // Setex: once in a while try creating a new incident just in case the old one was manually resolved
        await this.store.setex(idempotencyKey, 3600 * 3, id);
      }
    } else if (!isFiring && incidentId) {
      const resolutionMessage = message.join('\n');
      await this.resolveIncident(incidentId, blockContext.blockNumber, resolutionMessage);
      await this.store.del(idempotencyKey);
    }
  }

  private async createIncident(
    message: string[],
    notifications: NotificationSettings,
    incidentKey: IncidentKey,
    blockContext: BlockContext,
    isResolved: boolean,
    idempotencyKey: string,
  ): Promise<string | null> {
    const { channels, escalationChannels, escalationTimeoutMs, messengerType, repeatFiringMs } = notifications;

    const createIncidentDto: CreateIncidentDto = {
      message: message.join('\n'),
      chain: this.chain,
      blockNumber: blockContext.blockNumber,
      // Required fields
      account: incidentKey.account,
      groupId: incidentKey.groupId,
      handlerType: incidentKey.handlerType,
      idempotencyKey,
      notificationChannels: channels.map(channelId => ({ channelId, messengerType, repeatFiringMs })),
      // Optional fields
      escalationChannels: escalationChannels?.map(channelId => ({ channelId, messengerType })),
      escalationTimeoutMs,
      needsAck: notifications.needsAck || false,
      isResolved,
      // Used to build Subscan URLs
      eventIdx: blockContext.eventIdx,
      extrinsicIdx: blockContext.extrinsicIdx,
    };

    this.logger.debug(`Sending incident: ${JSON.stringify(createIncidentDto)}`);

    const incidentId = await this.reporter.createIncident(createIncidentDto);
    if (incidentId) {
      this.logger.debug(`Sent incident with ID: ${incidentId}`);
    } else {
      this.logger.debug('Skipping incident (reporter returned null).');
    }
    return incidentId;
  }

  private async resolveIncident(incidentId: string, blockNumber: number, resolutionMessage: string): Promise<void> {
    this.logger.debug(`Resolving incident with ID: ${incidentId}`);
    await this.reporter.resolveIncident(incidentId, { chain: this.chain, blockNumber, resolutionMessage });
  }
}
