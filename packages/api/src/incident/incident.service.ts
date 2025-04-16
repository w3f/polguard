import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Incident } from '../database/incident.entity';
import { CreateIncidentDto, GetIncidentsDto, ResolveIncidentDto } from './dto';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class IncidentService {
  private readonly logger = new Logger(IncidentService.name);

  constructor(
    @InjectRepository(Incident)
    private incidentRepository: Repository<Incident>,
    private notificationService: NotificationService,
  ) {}

  async findIncidents(filters: GetIncidentsDto): Promise<Incident[]> {
    const queryBuilder = this.incidentRepository.createQueryBuilder('incident');

    // Apply status filter
    if (filters.status && filters.status !== 'all') {
      switch (filters.status) {
        case 'open':
          queryBuilder.andWhere('incident.resolved = false');
          break;
        case 'acked':
          queryBuilder.andWhere('incident.acked = true AND incident.resolved = false');
          break;
        case 'unacked':
          queryBuilder.andWhere('incident.ackRequired = true AND incident.acked = false');
          break;
        case 'resolved':
          queryBuilder.andWhere('incident.resolved = true');
          break;
      }
    }

    // Apply direct boolean filters
    if (filters.ackRequired !== undefined) {
      queryBuilder.andWhere('incident.ackRequired = :ackRequired', { ackRequired: filters.ackRequired });
    }

    if (filters.acked !== undefined) {
      queryBuilder.andWhere('incident.acked = :acked', { acked: filters.acked });
    }

    if (filters.resolved !== undefined) {
      queryBuilder.andWhere('incident.resolved = :resolved', { resolved: filters.resolved });
    }

    // Apply other filters
    if (filters.createdAfter) {
      queryBuilder.andWhere('incident.createdAt >= :createdAfter', { createdAfter: filters.createdAfter });
    }

    if (filters.createdBefore) {
      queryBuilder.andWhere('incident.createdAt <= :createdBefore', { createdBefore: filters.createdBefore });
    }

    if (filters.chain) {
      queryBuilder.andWhere('incident.chain = :chain', { chain: filters.chain });
    }

    if (filters.wallet) {
      queryBuilder.andWhere('incident.wallet = :wallet', { wallet: filters.wallet });
    }

    if (filters.groupId) {
      queryBuilder.andWhere('incident.groupId = :groupId', { groupId: filters.groupId });
    }

    if (filters.handler) {
      queryBuilder.andWhere('incident.handler = :handler', { handler: filters.handler });
    }

    if (filters.channelId) {
      queryBuilder.andWhere('incident.channelId = :channelId', { channelId: filters.channelId });
    }

    // Apply limit and order
    queryBuilder.orderBy('incident.createdAt', 'DESC');
    queryBuilder.limit(1000); // Hard limit for now

    return queryBuilder.getMany();
  }

  async createIncident(createIncidentDto: CreateIncidentDto): Promise<Incident> {
    // Check for existing unresolved incidents with the same identifier (chain+groupId+handler+wallet)
    // to ensure idempotency. Skip for one-time incidents (events, extrinsics) that are immediately resolved.
    if (!createIncidentDto.resolved) {
      const existingIncident = await this.incidentRepository.findOne({
        where: {
          chain: createIncidentDto.chain,
          groupId: createIncidentDto.groupId,
          handler: createIncidentDto.handler,
          wallet: createIncidentDto.wallet,
          resolved: false,
        },
      });

      if (existingIncident) {
        return existingIncident;
      }
    }

    // Create new incident
    const incident = this.incidentRepository.create(createIncidentDto);

    // Set resolvedAt if the incident is created as resolved
    if (incident.resolved) {
      incident.resolvedAt = new Date();
    }

    const savedIncident = await this.incidentRepository.save(incident);

    // Send notification asynchronously
    this.notificationService.sendAlertNotification(savedIncident).catch(error => {
      this.logger.error(`Failed to send notification for incident ${savedIncident.id}`, error);
    });

    return savedIncident;
  }

  async acknowledgeIncident(id: number, username: string, channelId: string): Promise<Incident> {
    const incident = await this.incidentRepository.findOne({ where: { id } });

    if (!incident) {
      throw new NotFoundException(`Incident with ID ${id} not found`);
    }

    // Validate channel ID
    if (incident.channelId && incident.channelId !== channelId) {
      throw new ForbiddenException('Channel ID does not match the incident');
    }

    // Always update acknowledgment information if not previously acknowledged
    if (!incident.ackedAt) {
      incident.acked = true;
      incident.ackedAt = new Date();
      incident.ackedByUser = username;
    }

    return this.incidentRepository.save(incident);
  }

  async resolveIncidentById(id: number, resolvedMessage?: string): Promise<Incident> {
    const incident = await this.incidentRepository.findOne({ where: { id } });

    if (!incident) {
      throw new NotFoundException(`Incident with ID ${id} not found`);
    }

    // Check if incident is already resolved
    if (incident.resolvedAt) {
      throw new ForbiddenException(`Incident with ID ${id} is already resolved`);
    }

    // Update resolution information
    incident.resolved = true;
    incident.resolvedAt = new Date();
    if (resolvedMessage) {
      incident.resolvedMessage = resolvedMessage;
    }

    const savedIncident = await this.incidentRepository.save(incident);

    // Send notification for resolved incident
    this.notificationService.sendResolvedNotification(savedIncident).catch(error => {
      this.logger.error(`Failed to send resolution notification for incident ${savedIncident.id}`, error);
    });

    return savedIncident;
  }

  async resolveIncident(resolveIncidentDto: ResolveIncidentDto): Promise<Incident> {
    const { wallet, handler, chain, groupId, resolvedMessage } = resolveIncidentDto;

    // Find the incident using the provided fields
    const incident = await this.incidentRepository.findOne({
      where: {
        chain,
        groupId,
        handler,
        wallet,
        resolved: false,
      },
    });

    if (!incident) {
      throw new NotFoundException(`Incident not found for the provided criteria`);
    }

    // Update resolution information
    incident.resolved = true;
    incident.resolvedAt = new Date();
    if (resolvedMessage) {
      incident.resolvedMessage = resolvedMessage;
    }

    const savedIncident = await this.incidentRepository.save(incident);

    // Send notification for resolved incident
    this.notificationService.sendResolvedNotification(savedIncident).catch(error => {
      this.logger.error(`Failed to send resolution notification for incident ${savedIncident.id}`, error);
    });

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

    // Find all unresolved incidents where the wallet is NOT in the active accounts
    const orphanedIncidents = await this.incidentRepository
      .createQueryBuilder('incident')
      .where('incident.resolved = :resolved', { resolved: false })
      .andWhere('incident.wallet NOT IN (:...activeAccounts)', { activeAccounts })
      .getMany();

    if (orphanedIncidents.length === 0) {
      this.logger.debug('No incidents needed auto-resolution');
      return 0;
    }

    this.logger.log(`Auto-resolving ${orphanedIncidents.length} orphaned incidents`);

    let resolvedCount = 0;

    // Process all incidents
    for (const incident of orphanedIncidents) {
      try {
        await this.resolveIncidentById(
          incident.id,
          'Auto-resolved: Account no longer present in monitoring configuration',
        );
        resolvedCount++;
      } catch (error) {
        this.logger.error(`Failed to auto-resolve incident ${incident.id}`, error);
      }
    }

    // TODO: In the future, consider handler in addition to wallet address
    // when determining if an incident should be auto-resolved

    return resolvedCount;
  }
}
