import { createHash } from 'crypto';
import {
  AppLogger,
  NotificationSettings,
  Chain,
  IncidentContent,
  CreateIncidentBody,
  IncidentKey,
  Store,
  IncidentHandlerClient,
  IncidentReporter,
  BlockContext,
} from '../types';

/**
 * Build a unified idempotency key for both ongoing & one-time incidents.
 * Rule:
 * - Base = chain + (groupId, handlerType, account?, token?)
 * - Ongoing:  key = hash(Base)                    — stable across blocks
 * - One-time: key = hash(Base + block + position) — unique per occurrence
 */
function md5_16(parts: unknown[]): string {
  return createHash('md5').update(JSON.stringify(parts)).digest('hex').slice(0, 16);
}

function buildIdempotencyKey(chain: Chain, ik: IncidentKey, ctx: BlockContext, isOneTime: boolean): string {
  const base: unknown[] = [chain, ik.groupId, ik.handlerType, ik.account ?? null, ik.token ?? null];

  if (!isOneTime) {
    return `inc:${md5_16(base)}`;
  }

  return `inc:${md5_16([...base, ctx.blockNumber, ctx.eventIdx ?? null, ctx.extrinsicIdx ?? null, ctx.callIdx ?? null])}`;
}

/** `checkedAt` drives a periodic re-create, which re-alerts if the incident was resolved manually. */
interface OngoingIncident {
  id: string;
  checkedAt: number;
}

const RECHECK_MS = 3 * 60 * 60 * 1000;

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
    private logger: AppLogger,
    private store: Store,
    private reporter: IncidentReporter,
    private chain: Chain,
  ) {}

  async handle(
    content: IncidentContent,
    notifications: NotificationSettings,
    incidentKey: IncidentKey,
    blockContext: BlockContext,
    isFiring?: boolean,
  ): Promise<void> {
    // Compute the unified key once; use it for both API idempotency and KV store (ongoing).
    const isOneTime = isFiring === undefined;
    const idempotencyKey = buildIdempotencyKey(this.chain, incidentKey, blockContext, isOneTime);

    // One-time incident (created as immediately resolved)
    if (isOneTime) {
      await this.createIncident(content, notifications, incidentKey, blockContext, true, idempotencyKey);
      return;
    }

    // Ongoing incident lifecycle
    const open = await this.store.get<OngoingIncident>(idempotencyKey);

    if (isFiring) {
      if (open && Date.now() - open.checkedAt < RECHECK_MS) return;

      const id = await this.createIncident(content, notifications, incidentKey, blockContext, false, idempotencyKey);
      await this.store.set(idempotencyKey, { id, checkedAt: Date.now() } satisfies OngoingIncident);
    } else if (open) {
      await this.resolveIncident(open.id, blockContext.blockNumber, content);
      await this.store.del(idempotencyKey);
    }
  }

  private async createIncident(
    content: IncidentContent,
    notifications: NotificationSettings,
    incidentKey: IncidentKey,
    blockContext: BlockContext,
    isResolved: boolean,
    idempotencyKey: string,
  ): Promise<string> {
    const { channels, escalationChannels, escalationTimeoutMs, messengerType, repeatFiringMs } = notifications;

    const createIncidentBody: CreateIncidentBody = {
      content,
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

    this.logger.debug(`Reporting incident: ${JSON.stringify(createIncidentBody)}`);

    const incidentId = await this.reporter.createIncident(createIncidentBody);
    this.logger.debug(`Reported incident with ID: ${incidentId}`);
    return incidentId;
  }

  private async resolveIncident(incidentId: string, blockNumber: number, content: IncidentContent): Promise<void> {
    this.logger.debug(`Resolving incident with ID: ${incidentId}`);
    return this.reporter.resolveIncident(incidentId, { chain: this.chain, blockNumber, content });
  }
}
