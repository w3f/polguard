import { eq, and, lte, desc, inArray, sql, type SQL } from 'drizzle-orm';
import {
  AppLogger,
  NotificationType,
  MessengerType,
  ResolutionType,
  NotFoundError,
  ForbiddenError,
} from '@w3f/polguard-common';
import type { Database } from '../database/db';
import { incidents, notifications } from '../database/schema';
import { NotificationService } from '../notification/notification.service';
import { LastBlockService } from '../last-block/last-block.service';
import { generateIncidentId } from '../database/id-generator';
import type {
  CreateIncidentBody,
  GetIncidentsQuery,
  ResolveByChainBody,
  ResolveManuallyBody,
} from '../schemas/incident.schemas';

export class IncidentService {
  private static readonly AUTO_RESOLVE_TIMEOUT_MS = 30 * 24 * 60 * 60 * 1000;

  constructor(
    private readonly db: Database,
    private readonly notificationService: NotificationService,
    private readonly lastBlockService: LastBlockService,
    private readonly logger: AppLogger,
  ) {}

  async findIncidentById(id: string) {
    const incident = await this.db.query.incidents.findFirst({
      where: eq(incidents.id, id),
      with: { notifications: true },
    });

    if (!incident) {
      throw new NotFoundError(`Incident with ID ${id} not found`);
    }

    return incident;
  }

  async findIncidents(filters: GetIncidentsQuery) {
    const conditions: SQL[] = [];

    if (filters.needsAck !== undefined) {
      conditions.push(eq(incidents.needsAck, filters.needsAck));
    }
    if (filters.isAcked !== undefined) {
      conditions.push(eq(incidents.isAcked, filters.isAcked));
    }
    if (filters.isResolved !== undefined) {
      conditions.push(eq(incidents.isResolved, filters.isResolved));
    }
    if (filters.createdAfter) {
      conditions.push(sql`${incidents.createdAt} >= ${filters.createdAfter}`);
    }
    if (filters.createdBefore) {
      conditions.push(sql`${incidents.createdAt} <= ${filters.createdBefore}`);
    }
    if (filters.chain) {
      conditions.push(eq(incidents.chain, filters.chain));
    }
    if (filters.account) {
      conditions.push(eq(incidents.account, filters.account));
    }
    if (filters.groupId) {
      conditions.push(eq(incidents.groupId, filters.groupId));
    }
    if (filters.handlerType) {
      conditions.push(eq(incidents.handlerType, filters.handlerType));
    }

    // Channel + messengerType filter requires a join
    if (filters.channelId && filters.messengerType) {
      const matchingIncidentIds = await this.db
        .select({ incidentId: notifications.incidentId })
        .from(notifications)
        .where(
          and(eq(notifications.channelId, filters.channelId), eq(notifications.messengerType, filters.messengerType)),
        );

      const ids = matchingIncidentIds.map(r => r.incidentId);
      if (ids.length === 0) return [];
      conditions.push(inArray(incidents.id, ids));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    return this.db.query.incidents.findMany({
      where,
      with: { notifications: true },
      orderBy: desc(incidents.createdAt),
      limit: 1000,
    });
  }

  async createIncident(dto: CreateIncidentBody) {
    await this.lastBlockService.setLastBlock(dto.chain, dto.blockNumber);

    const isResolved = dto.isResolved ?? false;

    // Idempotency check
    const existing = await this.db.query.incidents.findFirst({
      where: and(eq(incidents.idempotencyKey, dto.idempotencyKey), eq(incidents.isResolved, isResolved)),
    });

    if (existing) {
      return existing;
    }

    const now = new Date();

    const [savedIncident] = await this.db
      .insert(incidents)
      .values({
        ...dto,
        id: generateIncidentId(),
        resolutionType: isResolved ? ResolutionType.ChainService : null,
        resolvedAt: isResolved ? now : null,
      })
      .returning();

    this.logger.debug(`Incident created: ${savedIncident.id}.`);

    await this.notificationService.createNotifications(
      savedIncident,
      dto.notificationChannels,
      NotificationType.Alert,
      dto.message,
    );

    return savedIncident;
  }

  async acknowledgeIncident(id: string, username: string, channelId: string) {
    const incident = await this.db.query.incidents.findFirst({
      where: eq(incidents.id, id),
    });

    if (!incident) {
      throw new NotFoundError(`Incident with ID ${id} not found`);
    }

    // Validate channel ID
    const hasNotification = await this.db.query.notifications.findFirst({
      where: and(eq(notifications.incidentId, id), eq(notifications.channelId, channelId)),
    });
    if (!hasNotification) {
      throw new ForbiddenError('User does not have permission to acknowledge this incident');
    }

    if (!incident.ackedAt) {
      const now = new Date();
      const [updated] = await this.db
        .update(incidents)
        .set({
          isAcked: true,
          ackedAt: now,
          ackedBy: username,
          updatedAt: now,
        })
        .where(eq(incidents.id, id))
        .returning();

      this.logger.debug(`Incident ${id} acknowledged by: ${username}.`);
      return updated;
    }

    this.logger.debug(`Incident ${id} acknowledged by: ${username}.`);
    return incident;
  }

  async resolveIncidentByChain(id: string, dto: ResolveByChainBody) {
    await this.lastBlockService.setLastBlock(dto.chain, dto.blockNumber);

    const incident = await this.db.query.incidents.findFirst({
      where: eq(incidents.id, id),
    });

    if (!incident) {
      throw new NotFoundError(`Incident with ID ${id} not found`);
    }
    if (incident.resolvedAt) {
      return incident;
    }

    const now = new Date();
    const [savedIncident] = await this.db
      .update(incidents)
      .set({
        resolutionType: ResolutionType.ChainService,
        resolutionMessage: dto.resolutionMessage,
        isResolved: true,
        resolvedAt: now,
        updatedAt: now,
      })
      .where(eq(incidents.id, id))
      .returning();

    this.logger.debug(`Incident ${id} resolved by chain service.`);

    await this.notificationService.createResolutionNotifications({
      id: savedIncident.id,
      needsAck: savedIncident.needsAck,
      isResolved: savedIncident.isResolved,
      resolutionMessage: savedIncident.resolutionMessage,
    });

    return savedIncident;
  }

  async resolveIncidentManually(id: string, dto: ResolveManuallyBody) {
    const incident = await this.db.query.incidents.findFirst({
      where: eq(incidents.id, id),
    });

    if (!incident) {
      throw new NotFoundError(`Incident with ID ${id} not found`);
    }
    if (incident.resolvedAt) {
      return incident;
    }

    // Validate channel ID
    const hasNotification = await this.db.query.notifications.findFirst({
      where: and(eq(notifications.incidentId, id), eq(notifications.channelId, dto.channelId)),
    });
    if (!hasNotification) {
      throw new ForbiddenError('User does not have permission to resolve this incident');
    }

    const now = new Date();
    const resolutionMessage = `Incident manually resolved by ${dto.username}`;
    const [savedIncident] = await this.db
      .update(incidents)
      .set({
        resolutionType: ResolutionType.Manual,
        resolutionMessage,
        resolvedBy: dto.username,
        isResolved: true,
        resolvedAt: now,
        updatedAt: now,
      })
      .where(eq(incidents.id, id))
      .returning();

    this.logger.debug(`Incident ${id} manually resolved by: ${dto.username}.`);

    await this.notificationService.createResolutionNotifications({
      id: savedIncident.id,
      needsAck: savedIncident.needsAck,
      isResolved: savedIncident.isResolved,
      resolutionMessage: savedIncident.resolutionMessage,
    });

    return savedIncident;
  }

  async escalateIncidents(): Promise<void> {
    const unescalatedIncidents = await this.db.query.incidents.findMany({
      where: and(eq(incidents.needsAck, true), eq(incidents.isAcked, false), eq(incidents.isEscalated, false)),
    });

    const now = Date.now();
    for (const i of unescalatedIncidents) {
      const escalationChannels = i.escalationChannels ?? [];
      const notificationChannels = i.notificationChannels;

      if (!i.escalationTimeoutMs || escalationChannels.length === 0) continue;
      if (now < i.createdAt.getTime() + i.escalationTimeoutMs) continue;

      const timeoutInMinutes = Math.floor(i.escalationTimeoutMs / 60000);
      const destinations = notificationChannels
        .map(c => (c.messengerType === MessengerType.Matrix ? `https://matrix.to/#/${c.channelId}` : c.channelId))
        .join(', ');

      const escalatedAt = new Date();
      await this.db
        .update(incidents)
        .set({ isEscalated: true, escalatedAt, updatedAt: escalatedAt })
        .where(eq(incidents.id, i.id));

      // Escalation channels: escalation message with original alert
      const escalationMessageWithOriginal =
        `Escalation. The incident was not acknowledged within ${timeoutInMinutes} minutes in any of the following rooms: ${destinations} ` +
        `(the original message is repeated below)\n\n${i.message}`;
      await this.notificationService.createNotifications(
        i,
        escalationChannels,
        NotificationType.Escalation,
        escalationMessageWithOriginal,
      );

      // Normal notification channels: short escalation message
      const shortEscalationMessage = `The incident was not acknowledged within ${timeoutInMinutes} minutes and has therefore been escalated`;
      await this.notificationService.createNotifications(
        i,
        notificationChannels,
        NotificationType.Escalation,
        shortEscalationMessage,
      );
    }
  }

  async autoResolveStaleIncidents(): Promise<void> {
    const cutoff = new Date(Date.now() - IncidentService.AUTO_RESOLVE_TIMEOUT_MS);

    const staleIncidents = await this.db.query.incidents.findMany({
      where: and(eq(incidents.isResolved, false), lte(incidents.createdAt, cutoff)),
    });

    if (staleIncidents.length === 0) {
      this.logger.debug('No stale incidents to auto-resolve.');
      return;
    }

    this.logger.info(`Auto-resolving ${staleIncidents.length} stale incidents (createdAt <= ${cutoff.toISOString()}).`);

    for (const incident of staleIncidents) {
      const now = new Date();
      const resolutionMessage = 'Incident auto-resolved by timeout policy (30 days).';

      await this.db
        .update(incidents)
        .set({
          isResolved: true,
          resolutionType: ResolutionType.AutoTimeout,
          resolutionMessage,
          resolvedAt: now,
          updatedAt: now,
        })
        .where(eq(incidents.id, incident.id));

      this.logger.info(`Incident ${incident.id} auto-resolved due to timeout.`);

      await this.notificationService.createNotifications(
        { ...incident, isResolved: true },
        incident.notificationChannels,
        NotificationType.Resolution,
        resolutionMessage,
      );
    }
  }
}
