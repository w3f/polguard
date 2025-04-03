import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Incident } from '../database/incident.entity';
import { CreateIncidentDto, GetIncidentsDto } from '../dto';
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
          queryBuilder.andWhere('incident.acked = false AND incident.resolved = false');
          break;
        case 'acked':
          queryBuilder.andWhere('incident.acked = true AND incident.resolved = false');
          break;
        case 'resolved':
          queryBuilder.andWhere('incident.resolved = true');
          break;
      }
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

    if (filters.groupName) {
      queryBuilder.andWhere('incident.groupName = :groupName', { groupName: filters.groupName });
    }

    if (filters.handlerName) {
      queryBuilder.andWhere('incident.handlerName = :handlerName', { handlerName: filters.handlerName });
    }

    // Apply limit and order
    queryBuilder.orderBy('incident.createdAt', 'DESC');
    queryBuilder.limit(1000); // Hard limit for now

    return queryBuilder.getMany();
  }

  async createIncident(createIncidentDto: CreateIncidentDto): Promise<Incident> {
    // Check for existing unresolved incidents with the same identifier (wallet+groupName+handlerName)
    // to ensure idempotency. Skip for one-time incidents (events, extrinsics) that are immediately resolved.
    if (!createIncidentDto.resolved) {
      const existingIncident = await this.incidentRepository.findOne({
        where: {
          wallet: createIncidentDto.wallet,
          groupName: createIncidentDto.groupName,
          handlerName: createIncidentDto.handlerName,
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

  async resolveIncident(id: number, resolvedMessage: string): Promise<Incident> {
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
    incident.resolvedMessage = resolvedMessage;

    const savedIncident = await this.incidentRepository.save(incident);

    // Send notification for resolved incident
    this.notificationService.sendResolvedNotification(savedIncident).catch(error => {
      this.logger.error(`Failed to send resolution notification for incident ${savedIncident.id}`, error);
    });

    return savedIncident;
  }
}
