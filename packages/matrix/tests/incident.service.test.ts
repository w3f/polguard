import { Test, TestingModule } from '@nestjs/testing';
import { IncidentService } from '../src/service/incident/incident.service';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '../src/service/config/config.service';
import { Logger } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { AxiosResponse } from 'axios';
import { MessengerType } from '@w3f/polguard-common';

describe('IncidentService', () => {
  let service: IncidentService;
  let httpServiceMock: Partial<HttpService>;
  let configServiceMock: Partial<ConfigService>;

  beforeEach(async () => {
    // Create mocks
    httpServiceMock = {
      get: jest.fn(),
      post: jest.fn(),
    };

    configServiceMock = {
      getIncidentsUrl: jest.fn().mockReturnValue('http://api:3000/incidents'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IncidentService,
        {
          provide: HttpService,
          useValue: httpServiceMock,
        },
        {
          provide: ConfigService,
          useValue: configServiceMock,
        },
        Logger,
      ],
    }).compile();

    service = module.get<IncidentService>(IncidentService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getNonResolved', () => {
    it('should return non-resolved incidents', async () => {
      const mockIncidents = [
        { id: 1, resolved: false },
        { id: 2, resolved: false },
      ];

      const mockResponse: AxiosResponse = {
        data: mockIncidents,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: { url: 'http://api:3000/incidents' } as any,
      };

      (httpServiceMock.get as jest.Mock).mockReturnValue(of(mockResponse));

      const result = await service.getNonResolved('test-room');

      expect(result).toEqual(mockIncidents);
      expect(httpServiceMock.get).toHaveBeenCalledWith('http://api:3000/incidents', {
        params: {
          channelId: 'test-room',
          messengerType: MessengerType.Matrix,
          isResolved: false,
        },
      });
    });

    it('should throw an error when the API call fails', async () => {
      const errorMessage = 'Network error';
      (httpServiceMock.get as jest.Mock).mockReturnValue(throwError(() => new Error(errorMessage)));

      await expect(service.getNonResolved('test-room')).rejects.toThrow(errorMessage);
    });
  });

  describe('getNonAcked', () => {
    it('should return non-acknowledged incidents', async () => {
      const mockIncidents = [
        { id: 1, ackRequired: true, acked: false },
        { id: 2, ackRequired: true, acked: false },
      ];

      const mockResponse: AxiosResponse = {
        data: mockIncidents,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: { url: 'http://api:3000/incidents' } as any,
      };

      (httpServiceMock.get as jest.Mock).mockReturnValue(of(mockResponse));

      const result = await service.getNonAcked('test-room');

      expect(result).toEqual(mockIncidents);
      expect(httpServiceMock.get).toHaveBeenCalledWith('http://api:3000/incidents', {
        params: {
          channelId: 'test-room',
          messengerType: MessengerType.Matrix,
          needsAck: true,
          isAcked: false,
        },
      });
    });
  });

  describe('getIncidentById', () => {
    it('should return an incident by ID', async () => {
      const mockIncident = { id: 'test-incident-1', message: 'Test incident' };

      const mockResponse: AxiosResponse = {
        data: mockIncident,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: { url: 'http://api:3000/incidents/test-incident-1' } as any,
      };

      (httpServiceMock.get as jest.Mock).mockReturnValue(of(mockResponse));

      const result = await service.getIncidentById('test-incident-1');

      expect(result).toEqual(mockIncident);
      expect(httpServiceMock.get).toHaveBeenCalledWith('http://api:3000/incidents/test-incident-1');
    });
  });

  describe('acknowledgeIncident', () => {
    it('should acknowledge an incident', async () => {
      const mockResponse: AxiosResponse = {
        data: { success: true },
        status: 201,
        statusText: 'Created',
        headers: {},
        config: { url: 'http://api:3000/incidents/test-incident-1/acknowledge' } as any,
      };

      (httpServiceMock.post as jest.Mock).mockReturnValue(of(mockResponse));

      await service.acknowledgeIncident('test-incident-1', 'test-user', 'test-room');

      expect(httpServiceMock.post).toHaveBeenCalledWith('http://api:3000/incidents/test-incident-1/acknowledge', {
        username: 'test-user',
        channelId: 'test-room',
      });
    });
  });
});
