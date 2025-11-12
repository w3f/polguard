import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Incident } from '../database/incident.entity';
import { Notification } from '../database/notification.entity';
import { CreateIncidentDto, GetIncidentsDto, ResolveIncidentByChainDto, ResolveIncidentManuallyDto } from './dto';
import { NotificationService } from '../notification/notification.service';
import { NotificationType, MessengerType, ResolutionType } from '@w3f/monitoring-common';
import { LastBlockService } from '../last-block/last-block.service';

@Injectable()
export class IncidentService {
  private readonly logger = new Logger(IncidentService.name);
  private static readonly AUTO_RESOLVE_TIMEOUT_MS = 30 * 24 * 60 * 60 * 1000;

  constructor(
    @InjectRepository(Incident)
    private incidentRepository: Repository<Incident>,
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
    private notificationService: NotificationService,
    private lastBlockService: LastBlockService,
  ) {}

  async findIncidentById(id: string): Promise<Incident> {
    const incident = await this.incidentRepository.findOne({
      where: { id },
      relations: ['notifications'],
    });

    if (!incident) {
      throw new NotFoundException(`Incident with ID ${id} not found`);
    }

    return incident;
  }

  async findIncidents(filters: GetIncidentsDto): Promise<Incident[]> {
    const queryBuilder = this.incidentRepository.createQueryBuilder('incident');

    if (filters.needsAck !== undefined) {
      queryBuilder.andWhere('incident.needsAck = :needsAck', { needsAck: filters.needsAck });
    }
    if (filters.isAcked !== undefined) {
      queryBuilder.andWhere('incident.isAcked = :isAcked', { isAcked: filters.isAcked });
    }
    if (filters.isResolved !== undefined) {
      queryBuilder.andWhere('incident.isResolved = :isResolved', { isResolved: filters.isResolved });
    }
    if (filters.createdAfter) {
      queryBuilder.andWhere('incident.createdAt >= :createdAfter', { createdAfter: filters.createdAfter });
    }
    if (filters.createdBefore) {
      queryBuilder.andWhere('incident.createdAt <= :createdBefore', { createdBefore: filters.createdBefore });
    }
    if (filters.chain) {
      queryBuilder.andWhere('incident.chain = :chain', { chain: filters.chain });
    }
    if (filters.account) {
      queryBuilder.andWhere('incident.account = :account', { account: filters.account });
    }
    if (filters.groupId) {
      queryBuilder.andWhere('incident.groupId = :groupId', { groupId: filters.groupId });
    }
    if (filters.handlerType) {
      queryBuilder.andWhere('incident.handlerType = :handlerType', { handlerType: filters.handlerType });
    }
    if (filters.channelId && filters.messengerType) {
      queryBuilder
        .innerJoin('incident.notifications', 'notification')
        .andWhere('notification.channelId = :channelId', { channelId: filters.channelId })
        .andWhere('notification.messengerType = :messengerType', { messengerType: filters.messengerType });
    }

    queryBuilder.orderBy('incident.createdAt', 'DESC');
    queryBuilder.limit(1000); // Hard limit for now
    queryBuilder.leftJoinAndSelect('incident.notifications', 'notifications');

    return queryBuilder.getMany();
  }

  async createIncident(dto: CreateIncidentDto): Promise<Incident> {
    await this.lastBlockService.setLastBlock(dto.chain, dto.blockNumber);

    const existingIncident = await this.incidentRepository.findOne({
      where: {
        idempotencyKey: dto.idempotencyKey,
        isResolved: dto.isResolved,
      },
    });

    if (existingIncident) {
      return existingIncident;
    }

    const { notificationChannels, ...incidentData } = dto;
    const incident = this.incidentRepository.create({
      ...incidentData,
      notificationChannels,
    });
    if (incident.isResolved) {
      incident.resolvedAt = new Date();
      incident.resolutionType = ResolutionType.ChainService;
    }

    const savedIncident = await this.incidentRepository.save(incident);
    this.logger.debug(`Incident created: ${savedIncident.id}.`);
    await this.notificationService.createNotifications(
      savedIncident,
      notificationChannels,
      NotificationType.Alert,
      incident.message,
    );
    return savedIncident;
  }

  async acknowledgeIncident(id: string, username: string, channelId: string): Promise<Incident> {
    const incident = await this.incidentRepository.findOne({ where: { id } });

    if (!incident) {
      throw new NotFoundException(`Incident with ID ${id} not found`);
    }

    // Validate channel ID by checking if there's a notification for this channel
    const hasNotificationForChannel = await this.notificationRepository.findOne({
      where: {
        incident: { id },
        channelId,
      },
    });
    if (!hasNotificationForChannel) {
      throw new ForbiddenException('User does not have permission to acknowledge this incident');
    }

    if (!incident.ackedAt) {
      incident.isAcked = true;
      incident.ackedAt = new Date();
      incident.ackedBy = username;
    }
    this.logger.debug(`Incident ${id} acknowledged by: ${username}.`);
    return this.incidentRepository.save(incident);
  }

  async resolveIncidentByChain(id: string, dto: ResolveIncidentByChainDto): Promise<Incident> {
    await this.lastBlockService.setLastBlock(dto.chain, dto.blockNumber);

    const incident = await this.incidentRepository.findOne({ where: { id } });

    if (!incident) {
      throw new NotFoundException(`Incident with ID ${id} not found`);
    }
    if (incident.resolvedAt) {
      return incident;
    }

    incident.resolutionType = ResolutionType.ChainService;
    incident.resolutionMessage = dto.resolutionMessage;
    incident.isResolved = true;
    incident.resolvedAt = new Date();

    const savedIncident = await this.incidentRepository.save(incident);
    this.logger.debug(`Incident ${id} resolved by chain service.`);

    await this.notificationService.createResolutionNotifications(savedIncident);
    return savedIncident;
  }

  async resolveIncidentManually(id: string, dto: ResolveIncidentManuallyDto): Promise<Incident> {
    const incident = await this.incidentRepository.findOne({ where: { id } });

    if (!incident) {
      throw new NotFoundException(`Incident with ID ${id} not found`);
    }
    if (incident.resolvedAt) {
      return incident;
    }

    // Validate channel ID by checking if there's a notification for this channel
    const hasNotificationForChannel = await this.notificationRepository.findOne({
      where: {
        incident: { id },
        channelId: dto.channelId,
      },
    });
    if (!hasNotificationForChannel) {
      throw new ForbiddenException('User does not have permission to resolve this incident');
    }

    incident.resolutionType = ResolutionType.Manual;
    incident.resolutionMessage = `Incident manually resolved by ${dto.username}`;
    incident.resolvedBy = dto.username;
    incident.isResolved = true;
    incident.resolvedAt = new Date();

    const savedIncident = await this.incidentRepository.save(incident);
    this.logger.debug(`Incident ${id} manually resolved by: ${dto.username}.`);

    await this.notificationService.createResolutionNotifications(savedIncident);
    return savedIncident;
  }

  async escalateIncidents(): Promise<void> {
    const incidents = await this.incidentRepository.find({
      where: {
        needsAck: true,
        isAcked: false,
        isEscalated: false,
      },
    });

    // Time check in Node for Postgres + SQLite compatibility (SQLite is used in integration tests).
    // The syntax is different between Postgres and SQLite.
    const now = Date.now();
    for (const i of incidents) {
      if (!i.escalationTimeoutMs || !i.escalationChannels) continue;
      if (now < i.createdAt.getTime() + i.escalationTimeoutMs) continue;

      const timeoutInMinutes = Math.floor((i.escalationTimeoutMs ?? 0) / 60000);
      const destinations = i.notificationChannels
        .map(c => (c.messengerType === MessengerType.Matrix ? `https://matrix.to/#/${c.channelId}` : c.channelId))
        .join(', ');

      i.isEscalated = true;
      i.escalatedAt = new Date();
      await this.incidentRepository.save(i);

      // Escalation channels: escalation message with destinations plus original alert
      const escalationMessageWithOriginal =
        `Escalation. The incident was not acknowledged within ${timeoutInMinutes} minutes in any of the following rooms: ${destinations} ` +
        `(the original message is repeated below)\n\n${i.message}`;
      await this.notificationService.createNotifications(
        i,
        i.escalationChannels,
        NotificationType.Escalation,
        escalationMessageWithOriginal,
      );

      // Normal notification channels: short escalation message
      const shortEscalationMessage = `The incident was not acknowledged within ${timeoutInMinutes} minutes and has therefore been escalated`;
      await this.notificationService.createNotifications(
        i,
        i.notificationChannels,
        NotificationType.Escalation,
        shortEscalationMessage,
      );
    }
  }

  async autoResolveStaleIncidents(): Promise<void> {
    const now = Date.now();
    const cutoff = new Date(now - IncidentService.AUTO_RESOLVE_TIMEOUT_MS);

    const staleIncidents = await this.incidentRepository
      .createQueryBuilder('incident')
      .where('incident.isResolved = :isResolved', { isResolved: false })
      .andWhere('incident.createdAt <= :cutoff', { cutoff })
      .getMany();

    if (staleIncidents.length === 0) {
      this.logger.debug('No stale incidents to auto-resolve.');
      return;
    }

    this.logger.log(`Auto-resolving ${staleIncidents.length} stale incidents (createdAt <= ${cutoff.toISOString()}).`);

    for (const incident of staleIncidents) {
      incident.isResolved = true;
      incident.resolutionType = ResolutionType.AutoTimeout;
      incident.resolutionMessage = 'Incident auto-resolved by timeout policy (30 days).';
      incident.resolvedAt = new Date();

      const savedIncident = await this.incidentRepository.save(incident);
      this.logger.log(`Incident ${incident.id} auto-resolved due to timeout.`);

      await this.notificationService.createNotifications(
        savedIncident,
        incident.notificationChannels,
        NotificationType.Resolution,
        incident.resolutionMessage,
      );
    }
  }
}
