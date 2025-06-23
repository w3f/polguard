import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { Chain, MessengerType, NotificationType } from '@w3f/monitoring-types';
import { DataSource } from 'typeorm';
import { cleanupTestDatabase, createTestApp } from './test-utils';
import { Notification } from '../../src/database/notification.entity';

describe('Incident API (integration)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let notificationRepo: any;

  // Test data
  const testWallet = '5DAAnrj7VHTznn2AWBemMuyBwZWs6FNFjdyVXUeYum3PTXFy';
  
  // Helper function to create test incidents
  const createTestIncident = (overrides = {}) => ({
    message: 'Test incident',
    chain: Chain.Polkadot,
    blockNumber: 12345,
    account: testWallet,
    groupId: 'validators-test-group',
    handlerType: 'test-handler',
    notificationChannels: [
      { channelId: 'test-channel', messengerType: MessengerType.Matrix, repeatHours: 1.0 }
    ],
    needsAck: true,
    idempotencyKey: `test-key-${Date.now()}`, // Default unique key
    ...overrides
  });
  
  beforeAll(async () => {
    const { app: testApp, moduleFixture } = await createTestApp();
    app = testApp;
    dataSource = moduleFixture.get<DataSource>(DataSource);
    notificationRepo = dataSource.getRepository(Notification);
  });

  afterAll(async () => {
    await app.close();
    if (dataSource && dataSource.isInitialized) {
      await dataSource.destroy();
    }
    cleanupTestDatabase();
  });

  it('handles one-time incident workflow with notifications', async () => {
    // Create one-time incident (instantly resolved)
    const createResponse = await request(app.getHttpServer())
      .post('/incidents')
      .send(createTestIncident({ isResolved: true }))
      .expect(201);
    
    const id = createResponse.body.id;
    expect(createResponse.body.isResolved).toBe(true);
    
    // Verify notification was created
    const notifications = await notificationRepo.find({
      where: { incident: { id } }
    });
    expect(notifications.length).toBeGreaterThan(0);
    expect(notifications[0].channelId).toBe('test-channel');
    
    // Create notification record for acknowledgment
    await notificationRepo.save({
      incident: { id },
      channelId: 'test-channel',
      messengerType: MessengerType.Matrix,
      type: NotificationType.Alert,
      repeatHours: 1.0,
      isDelivered: true,
      message: 'Test incident',
      lastSentAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    // Acknowledge the incident
    await request(app.getHttpServer())
      .post(`/incidents/${id}/acknowledge`)
      .send({ username: 'test-user', channelId: 'test-channel' })
      .expect(201);
    
    // Verify incident state
    const getResponse = await request(app.getHttpServer())
      .get(`/incidents?isAcked=true`)
      .expect(200);
    
    expect(getResponse.body.some(inc => inc.id === id)).toBe(true);
  });

  it('handles firing incident workflow with resolution notifications', async () => {
    // Create firing incident (not instantly resolved)
    const createResponse = await request(app.getHttpServer())
      .post('/incidents')
      .send(createTestIncident({ isResolved: false }))
      .expect(201);
    
    const id = createResponse.body.id;
    expect(createResponse.body.isResolved).toBe(false);
    
    // Create notification record for acknowledgment
    await notificationRepo.save({
      incident: { id },
      channelId: 'test-channel',
      messengerType: MessengerType.Matrix,
      type: NotificationType.Alert,
      repeatHours: 1.0,
      isDelivered: true,
      message: 'Test incident',
      lastSentAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    // Acknowledge the incident
    await request(app.getHttpServer())
      .post(`/incidents/${id}/acknowledge`)
      .send({ username: 'test-user', channelId: 'test-channel' })
      .expect(201);
    
    // Resolve the incident
    await request(app.getHttpServer())
      .post(`/incidents/${id}/resolve`)
      .expect(201);
    
    // Verify resolution notification was created
    const notifications = await notificationRepo.find({
      where: { 
        incident: { id },
        type: NotificationType.Resolution
      }
    });
    expect(notifications.length).toBeGreaterThan(0);
    
    // Verify incident state
    const getResponse = await request(app.getHttpServer())
      .get(`/incidents?isResolved=true`)
      .expect(200);
    
    expect(getResponse.body.some(inc => inc.id === id)).toBe(true);
  });

  it('handles idempotent incident creation', async () => {
    const idempotencyKey = 'test-idempotency-key-fixed';
    
    // Create first incident
    const firstResponse = await request(app.getHttpServer())
      .post('/incidents')
      .send(createTestIncident({
        message: 'Duplicate test',
        idempotencyKey
      }))
      .expect(201);
    
    const duplicateResponse = await request(app.getHttpServer())
      .post('/incidents')
      .send(createTestIncident({
        message: 'Duplicate test - different message',
        idempotencyKey
      }))
      .expect(201);
    
    // Verify same ID returned (idempotency)
    expect(duplicateResponse.body.id).toBe(firstResponse.body.id);
  });

  it('handles error cases properly', async () => {
    // Try to acknowledge non-existent incident
    await request(app.getHttpServer())
      .post('/incidents/NONEXISTENT123/acknowledge')
      .send({ username: 'test-user', channelId: 'test-channel' })
      .expect(404);
    
    // Create incident that doesn't need acknowledgment
    const noAckResponse = await request(app.getHttpServer())
      .post('/incidents')
      .send(createTestIncident({ needsAck: false }))
      .expect(201);
    
    // Try to acknowledge incident that doesn't need it
    await request(app.getHttpServer())
      .post(`/incidents/${noAckResponse.body.id}/acknowledge`)
      .send({ username: 'test-user', channelId: 'test-channel' })
      .expect(403);
  });

  it('supports filtering incidents', async () => {
    // Create incident with specific properties for filtering
    await request(app.getHttpServer())
      .post('/incidents')
      .send(createTestIncident({ 
        chain: Chain.Kusama,
        account: 'test-account-kusama',
        handlerType: 'test-handler-filter'
      }))
      .expect(201);
    
    // Test filtering by chain
    const chainFilter = await request(app.getHttpServer())
      .get(`/incidents?chain=${Chain.Kusama}`)
      .expect(200);
    
    expect(chainFilter.body.some(inc => inc.account === 'test-account-kusama')).toBe(true);
  });

  it('gets incident by ID', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/incidents')
      .send(createTestIncident({ 
        message: 'Test incident for ID retrieval',
        account: 'test-account-by-id'
      }))
      .expect(201);
    
    const incidentId = createResponse.body.id;
    
    const getResponse = await request(app.getHttpServer())
      .get(`/incidents/${incidentId}`)
      .expect(200);
    
    expect(getResponse.body.id).toBe(incidentId);
    expect(getResponse.body.message).toContain('Test incident for ID retrieval');
    expect(getResponse.body.account).toBe('test-account-by-id');
    expect(getResponse.body.notifications).toBeDefined();
  });

  it('returns 404 for non-existent incident ID', async () => {
    await request(app.getHttpServer())
      .get('/incidents/NONEXISTENT123')
      .expect(404);
  });
});
