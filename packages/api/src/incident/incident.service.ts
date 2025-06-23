import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Incident } from '../database/incident.entity';
import { Notification } from '../database/notification.entity';
import { CreateIncidentDto, GetIncidentsDto } from './dto';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '@w3f/monitoring-types';

@Injectable()
export class IncidentService {
  private readonly logger = new Logger(IncidentService.name);

  constructor(
    @InjectRepository(Incident)
    private incidentRepository: Repository<Incident>,
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
    private notificationService: NotificationService,
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
    // Check for existing unresolved incidents with the same idempotency key
    // to ensure idempotency. Skip for one-time incidents that are immediately resolved.
    if (!dto.isResolved) {
      const existingIncident = await this.incidentRepository.findOne({
        where: {
          idempotencyKey: dto.idempotencyKey,
          isResolved: false,
        },
      });

      if (existingIncident) {
        return existingIncident;
      }
    }

    const { notificationChannels, ...incidentData } = dto;
    const incident = this.incidentRepository.create(incidentData);
    if (incident.isResolved) {
      incident.resolvedAt = new Date();
    }

    const savedIncident = await this.incidentRepository.save(incident);
    await this.notificationService.createNotifications(savedIncident, notificationChannels, NotificationType.Alert);
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
      throw new ForbiddenException('Channel ID does not match any notification for this incident');
    }

    // Check if acknowledgment is required
    if (!incident.needsAck) {
      throw new ForbiddenException(`Incident with ID ${id} does not require acknowledgment`);
    }

    if (!incident.ackedAt) {
      incident.isAcked = true;
      incident.ackedAt = new Date();
      incident.ackedBy = username;
    }

    return this.incidentRepository.save(incident);
  }

  async resolveIncidentById(id: string): Promise<Incident> {
    const incident = await this.incidentRepository.findOne({ where: { id } });

    if (!incident) {
      throw new NotFoundException(`Incident with ID ${id} not found`);
    }
    if (incident.resolvedAt) {
      throw new ForbiddenException(`Incident with ID ${id} is already resolved`);
    }

    incident.isResolved = true;
    incident.resolvedAt = new Date();
    const savedIncident = await this.incidentRepository.save(incident);

    await this.notificationService.createResolutionNotifications(savedIncident);
    return savedIncident;
  }

  /**
   * Auto-resolves incidents for accounts that are no longer in the monitoring configuration
   * @param activeAccounts List of all active accounts from monitoring configuration
   * @returns Number of incidents that were auto-resolved
   */
  async autoResolveOrphanedIncidents(activeAccounts: string[]): Promise<number> {
    // Safety check - if no active accounts, something might be wrong with configuration
    if (activeAccounts.length === 0) {
      this.logger.warn('No active accounts found in monitoring configuration. Skipping auto-resolution.');
      return 0;
    }

    // Find all unresolved incidents where the account is NOT in the active accounts
    const orphanedIncidents = await this.incidentRepository
      .createQueryBuilder('incident')
      .where('incident.isResolved = :isResolved', { isResolved: false })
      .andWhere('incident.account NOT IN (:...activeAccounts)', { activeAccounts })
      .getMany();

    if (orphanedIncidents.length === 0) {
      this.logger.debug('No incidents needed auto-resolution');
      return 0;
    }

    this.logger.log(`Auto-resolving ${orphanedIncidents.length} orphaned incidents`);

    let resolvedCount = 0;
    for (const incident of orphanedIncidents) {
      try {
        await this.resolveIncidentById(incident.id);
        resolvedCount++;
      } catch (error) {
        this.logger.error(`Failed to auto-resolve incident ${incident.id}`, error);
      }
    }

    return resolvedCount;
  }
}
