import { Test, TestingModule } from '@nestjs/testing';
import { IncidentService } from '../../../src/incident/incident.service';
import { Repository } from 'typeorm';
import { Incident } from '../../../src/database/incident.entity';
import { Notification } from '../../../src/database/notification.entity';
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
  notificationChannels: [{ channelId: 'test-channel', messengerType: MessengerType.Matrix, repeatHours: 1.5 }],
  needsAck: true,
  idempotencyKey: 'test-key',
  ...overrides
});

describe('IncidentService', () => {
  let service: IncidentService;
  let incidentRepo: MockRepository<Incident>;
  let notificationRepo: MockRepository<Notification>;
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
        { provide: getRepositoryToken(Notification), useValue: notificationRepo },
        { provide: NotificationService, useValue: notificationService },
      ],
    }).compile();

    service = module.get<IncidentService>(IncidentService);
  });

  describe('findIncidentById', () => {
    it('returns incident when found', async () => {
      const id = 'TEST123ABC456';
      const incident = { id, message: 'Test incident', notifications: [] };
      incidentRepo.findOne.mockResolvedValue(incident);
      
      const result = await service.findIncidentById(id);
      
      expect(result).toBe(incident);
      expect(incidentRepo.findOne).toHaveBeenCalledWith({
        where: { id },
        relations: ['notifications'],
      });
    });

    it('throws NotFoundException when incident not found', async () => {
      const id = 'NONEXISTENT123';
      incidentRepo.findOne.mockResolvedValue(null);
      
      await expect(service.findIncidentById(id))
        .rejects.toThrow(NotFoundException);
      
      expect(incidentRepo.findOne).toHaveBeenCalledWith({
        where: { id },
        relations: ['notifications'],
      });
    });
  });

  describe('createIncident', () => {
    it('creates a new incident', async () => {
      const id = 'NEW123ABC456';
      const dto = createTestIncidentDto();
      const savedIncident = { id, ...dto };
      
      incidentRepo.findOne.mockResolvedValue(null);
      incidentRepo.create.mockReturnValue(savedIncident);
      incidentRepo.save.mockResolvedValue(savedIncident);
      
      const result = await service.createIncident(dto);
      
      expect(result.id).toBe(id);
      expect(incidentRepo.save).toHaveBeenCalled();
      expect(notificationService.createNotifications).toHaveBeenCalledWith(
        savedIncident, dto.notificationChannels, NotificationType.Alert
      );
    });

    it('returns existing incident if duplicate', async () => {
      const id = 'EXISTING123';
      const dto = createTestIncidentDto({ isResolved: false });
      const existingIncident = { id, ...dto };
      
      incidentRepo.findOne.mockResolvedValue(existingIncident);
      
      const result = await service.createIncident(dto);
      
      expect(result).toBe(existingIncident);
      expect(incidentRepo.save).not.toHaveBeenCalled();
    });

    it('sets resolvedAt for resolved incidents', async () => {
      const id = 'RESOLVED123';
      const dto = createTestIncidentDto({ isResolved: true });
      const incident = { id, ...dto, resolvedAt: undefined };
      
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
      const id = 'ACK123ABC456';
      const incident = {
        id, needsAck: true, isAcked: false, ackedAt: null, ackedBy: null
      };
      
      incidentRepo.findOne.mockResolvedValue(incident);
      notificationRepo.findOne.mockResolvedValue({ channelId: 'test-channel' });
      incidentRepo.save.mockImplementation(inc => Promise.resolve(inc));
      
      const result = await service.acknowledgeIncident(id, 'test-user', 'test-channel');
      
      expect(result.isAcked).toBe(true);
      expect(result.ackedBy).toBe('test-user');
    });

    it('throws NotFoundException if incident not found', async () => {
      const id = 'NOTFOUND123';
      incidentRepo.findOne.mockResolvedValue(null);
      
      await expect(service.acknowledgeIncident(id, 'user', 'channel'))
        .rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException if ack not required', async () => {
      const id = 'NOACK123';
      incidentRepo.findOne.mockResolvedValue({ id, needsAck: false });
      notificationRepo.findOne.mockResolvedValue({ channelId: 'test-channel' });
      
      await expect(service.acknowledgeIncident(id, 'user', 'test-channel'))
        .rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException if channel mismatch', async () => {
      const id = 'WRONGCH123';
      incidentRepo.findOne.mockResolvedValue({ id, needsAck: true });
      notificationRepo.findOne.mockResolvedValue(null);
      
      await expect(service.acknowledgeIncident(id, 'user', 'wrong-channel'))
        .rejects.toThrow(ForbiddenException);
    });
  });

  describe('resolveIncidentById', () => {
    it('resolves an incident', async () => {
      const id = 'RESOLVE123';
      const incident = { id, isResolved: false, resolvedAt: null };
      
      incidentRepo.findOne.mockResolvedValue(incident);
      incidentRepo.save.mockImplementation(inc => Promise.resolve(inc));
      
      const result = await service.resolveIncidentById(id);
      
      expect(result.isResolved).toBe(true);
      expect(result.resolvedAt).toBeDefined();
      expect(notificationService.createResolutionNotifications).toHaveBeenCalledWith(result);
    });

    it('throws NotFoundException if incident not found', async () => {
      const id = 'NOTFOUND456';
      incidentRepo.findOne.mockResolvedValue(null);
      
      await expect(service.resolveIncidentById(id))
        .rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException if already resolved', async () => {
      const id = 'ALREADY789';
      incidentRepo.findOne.mockResolvedValue({ 
        id, isResolved: true, resolvedAt: new Date() 
      });
      
      await expect(service.resolveIncidentById(id))
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
