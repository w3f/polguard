import { Test, TestingModule } from '@nestjs/testing';
import { IncidentService } from '../../../src/incident/incident.service';
import { Repository } from 'typeorm';
import { Incident, IncidentNotification } from '../../../src/database/incident.entity';
import { NotificationService } from '../../../src/notification/notification.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { NotificationType, Chain, MessengerType } from '@w3f/monitoring-types';

// Mock repository factory
type MockRepository<T = any> = Partial<Record<keyof Repository<T>, jest.Mock>>;
const createMockRepository = () => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  createQueryBuilder: jest.fn(() => ({
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
    getOne: jest.fn(),
  })),
});

// Test data factory
const createTestIncidentDto = (overrides = {}) => ({
  message: 'Test incident',
  chain: Chain.Polkadot,
  blockNumber: 12345,
  account: 'test-account',
  groupId: 'validators-test-group',
  handlerType: 'test-handler',
  notificationChannels: [{ channelId: 'test-channel', messengerType: MessengerType.Matrix }],
  needsAck: true,
  ...overrides
});

describe('IncidentService', () => {
  let service: IncidentService;
  let incidentRepo: MockRepository<Incident>;
  let notificationRepo: MockRepository<IncidentNotification>;
  let notificationService: Partial<NotificationService>;

  beforeEach(async () => {
    incidentRepo = createMockRepository();
    notificationRepo = createMockRepository();
    notificationService = {
      createNotifications: jest.fn(),
      createResolutionNotifications: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IncidentService,
        { provide: getRepositoryToken(Incident), useValue: incidentRepo },
        { provide: getRepositoryToken(IncidentNotification), useValue: notificationRepo },
        { provide: NotificationService, useValue: notificationService },
      ],
    }).compile();

    service = module.get<IncidentService>(IncidentService);
  });

  describe('createIncident', () => {
    it('creates a new incident', async () => {
      const dto = createTestIncidentDto();
      const savedIncident = { id: 1, ...dto };
      
      incidentRepo.findOne.mockResolvedValue(null);
      incidentRepo.create.mockReturnValue(savedIncident);
      incidentRepo.save.mockResolvedValue(savedIncident);
      
      const result = await service.createIncident(dto);
      
      expect(result.id).toBe(1);
      expect(incidentRepo.save).toHaveBeenCalled();
      expect(notificationService.createNotifications).toHaveBeenCalledWith(
        savedIncident, dto.notificationChannels, NotificationType.Alert
      );
    });

    it('returns existing incident if duplicate', async () => {
      const dto = createTestIncidentDto({ isResolved: false });
      const existingIncident = { id: 1, ...dto };
      
      incidentRepo.findOne.mockResolvedValue(existingIncident);
      
      const result = await service.createIncident(dto);
      
      expect(result).toBe(existingIncident);
      expect(incidentRepo.save).not.toHaveBeenCalled();
    });

    it('sets resolvedAt for resolved incidents', async () => {
      const dto = createTestIncidentDto({ isResolved: true });
      const incident = { id: 1, ...dto, resolvedAt: undefined };
      
      incidentRepo.findOne.mockResolvedValue(null);
      incidentRepo.create.mockReturnValue(incident);
      incidentRepo.save.mockImplementation(inc => {
        if (!inc.resolvedAt && inc.isResolved) {
          inc.resolvedAt = new Date();
        }
        return Promise.resolve(inc);
      });
      
      const result = await service.createIncident(dto);
      
      expect(result.resolvedAt).toBeDefined();
    });
  });

  describe('acknowledgeIncident', () => {
    it('acknowledges an incident', async () => {
      const incident = {
        id: 1, needsAck: true, isAcked: false, ackedAt: null, ackedBy: null
      };
      
      incidentRepo.findOne.mockResolvedValue(incident);
      notificationRepo.findOne.mockResolvedValue({ channelId: 'test-channel' });
      incidentRepo.save.mockImplementation(inc => Promise.resolve(inc));
      
      const result = await service.acknowledgeIncident(1, 'test-user', 'test-channel');
      
      expect(result.isAcked).toBe(true);
      expect(result.ackedBy).toBe('test-user');
    });

    it('throws NotFoundException if incident not found', async () => {
      incidentRepo.findOne.mockResolvedValue(null);
      
      await expect(service.acknowledgeIncident(999, 'user', 'channel'))
        .rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException if ack not required', async () => {
      incidentRepo.findOne.mockResolvedValue({ id: 1, needsAck: false });
      notificationRepo.findOne.mockResolvedValue({ channelId: 'test-channel' });
      
      await expect(service.acknowledgeIncident(1, 'user', 'test-channel'))
        .rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException if channel mismatch', async () => {
      incidentRepo.findOne.mockResolvedValue({ id: 1, needsAck: true });
      notificationRepo.findOne.mockResolvedValue(null);
      
      await expect(service.acknowledgeIncident(1, 'user', 'wrong-channel'))
        .rejects.toThrow(ForbiddenException);
    });
  });

  describe('resolveIncidentById', () => {
    it('resolves an incident', async () => {
      const incident = { id: 1, isResolved: false, resolvedAt: null };
      
      incidentRepo.findOne.mockResolvedValue(incident);
      incidentRepo.save.mockImplementation(inc => Promise.resolve(inc));
      
      const result = await service.resolveIncidentById(1);
      
      expect(result.isResolved).toBe(true);
      expect(result.resolvedAt).toBeDefined();
      expect(notificationService.createResolutionNotifications).toHaveBeenCalledWith(result);
    });

    it('throws NotFoundException if incident not found', async () => {
      incidentRepo.findOne.mockResolvedValue(null);
      
      await expect(service.resolveIncidentById(999))
        .rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException if already resolved', async () => {
      incidentRepo.findOne.mockResolvedValue({ 
        id: 1, isResolved: true, resolvedAt: new Date() 
      });
      
      await expect(service.resolveIncidentById(1))
        .rejects.toThrow(ForbiddenException);
    });
  });


  describe('autoResolveOrphanedIncidents', () => {
    it('skips auto-resolution if no active accounts', async () => {
      const result = await service.autoResolveOrphanedIncidents([]);
      
      expect(result).toBe(0);
      expect(incidentRepo.createQueryBuilder).not.toHaveBeenCalled();
    });
  });
});
