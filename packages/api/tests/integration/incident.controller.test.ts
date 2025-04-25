import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { Chain, MessengerType } from '@w3f/monitoring-types';
import { CreateIncidentDto } from '../../src/incident/dto';
import { DataSource } from 'typeorm';
import { setupTestDatabase, createTestApp } from './test-utils';

describe('IncidentController (integration)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let testIncidentId: number;

  // Test data
  const testGroup = 'test-group';
  const testWallet = '5DAAnrj7VHTznn2AWBemMuyBwZWs6FNFjdyVXUeYum3PTXFy';
  
  beforeAll(async () => {
    await setupTestDatabase();
    const { app: testApp, moduleFixture } = await createTestApp();
    app = testApp;
    dataSource = moduleFixture.get<DataSource>(DataSource);
  });

  afterAll(async () => {
    await app.close();
    if (dataSource && dataSource.isInitialized) {
      await dataSource.destroy();
    }
  });

  describe('Incident CRUD operations', () => {
    it('should create and retrieve incidents', async () => {
      // Create a test incident
      const createIncidentDto: CreateIncidentDto = {
        message: 'Test incident',
        chain: Chain.Polkadot,
        blockNumber: 12345,
        account: testWallet,
        groupId: testGroup,
        handlerType: 'test-handler',
        notificationChannels: [
          {
            channelId: 'test-channel',
            messengerType: MessengerType.Matrix,
            repeatHours: 24
          }
        ],
        needsAck: true,
      };

      const createResponse = await request(app.getHttpServer())
        .post('/incidents')
        .send(createIncidentDto)
        .expect(201);

      testIncidentId = createResponse.body.id;
      expect(createResponse.body.message).toBe(createIncidentDto.message);
      expect(createResponse.body.isAcked).toBe(false);
      expect(createResponse.body.isResolved).toBe(false);

      // Get all incidents
      const getAllResponse = await request(app.getHttpServer())
        .get('/incidents')
        .expect(200);

      expect(Array.isArray(getAllResponse.body)).toBe(true);
      expect(getAllResponse.body.length).toBeGreaterThan(0);
    });

    it('should filter incidents by status', async () => {
      // Get unresolved incidents
      const openResponse = await request(app.getHttpServer())
        .get('/incidents?status=open')
        .expect(200);

      expect(Array.isArray(openResponse.body)).toBe(true);
      if (openResponse.body.length > 0) {
        expect(openResponse.body[0].isResolved).toBe(false);
      }

      // Create an incident requiring acknowledgment
      const unackedIncidentDto: CreateIncidentDto = {
        message: 'Test incident requiring acknowledgment',
        chain: Chain.Polkadot,
        blockNumber: 12346,
        account: testWallet,
        groupId: testGroup,
        handlerType: 'test-handler-unacked',
        notificationChannels: [
          {
            channelId: 'test-channel',
            messengerType: MessengerType.Matrix
          }
        ],
        needsAck: true,
      };

      await request(app.getHttpServer())
        .post('/incidents')
        .send(unackedIncidentDto)
        .expect(201);

      // Get incidents requiring acknowledgment
      const unackedResponse = await request(app.getHttpServer())
        .get('/incidents?status=unacked')
        .expect(200);

      expect(Array.isArray(unackedResponse.body)).toBe(true);
      if (unackedResponse.body.length > 0) {
        expect(unackedResponse.body[0].needsAck).toBe(true);
        expect(unackedResponse.body[0].isAcked).toBe(false);
      }
    });

    it('should acknowledge and resolve incidents', async () => {
      // Create an incident for acknowledgment
      const ackIncidentDto: CreateIncidentDto = {
        message: 'Test incident for acknowledgment',
        chain: Chain.Polkadot,
        blockNumber: 12347,
        account: testWallet,
        groupId: testGroup,
        handlerType: 'test-handler-ack',
        notificationChannels: [
          {
            channelId: 'test-channel',
            messengerType: MessengerType.Matrix
          }
        ],
        needsAck: true,
      };

      const createResponse = await request(app.getHttpServer())
        .post('/incidents')
        .send(ackIncidentDto)
        .expect(201);
      
      const incidentId = createResponse.body.id;
      
      // Manually create a notification record in the database
      const notificationRepo = dataSource.getRepository('incident_notifications');
      await notificationRepo.save({
        incident: { id: incidentId },
        channelId: 'test-channel',
        messengerType: MessengerType.Matrix,
        type: 'alert',
        isDelivered: true,
        lastSentAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      // Acknowledge the incident
      const ackResponse = await request(app.getHttpServer())
        .post(`/incidents/${incidentId}/acknowledge`)
        .send({
          username: 'test-user',
          channelId: 'test-channel',
        })
        .expect(201);

      expect(ackResponse.body.id).toBe(incidentId);
      expect(ackResponse.body.isAcked).toBe(true);
      expect(ackResponse.body.ackedBy).toBe('test-user');
      
      // Resolve the incident
      const resolveResponse = await request(app.getHttpServer())
        .post(`/incidents/${testIncidentId}/resolve`)
        .expect(201);

      expect(resolveResponse.body.id).toBe(testIncidentId);
      expect(resolveResponse.body.isResolved).toBe(true);
      
      // Get resolved incidents
      const resolvedResponse = await request(app.getHttpServer())
        .get('/incidents?isResolved=true')
        .expect(200);

      expect(Array.isArray(resolvedResponse.body)).toBe(true);
      if (resolvedResponse.body.length > 0) {
        expect(resolvedResponse.body[0].isResolved).toBe(true);
      }
    });
  });
});
