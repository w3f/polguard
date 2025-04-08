import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { Chain, MessengerType } from '@w3f/monitoring-types';
import { CreateIncidentDto } from '../../src/incident/dto';
import { DataSource } from 'typeorm';
import { setupTestDatabase, createTestApp } from './test-utils';

describe('IncidentController (integration)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let createdIncidentId: number;

  // Test data
  const testGroup = 'test-group';
  const testWallet = '5DAAnrj7VHTznn2AWBemMuyBwZWs6FNFjdyVXUeYum3PTXFy';
  
  beforeAll(async () => {
    // Setup test database
    await setupTestDatabase();
    
    // Create test app with shared fixture
    const { app: testApp, moduleFixture } = await createTestApp();
    app = testApp;
    
    dataSource = moduleFixture.get<DataSource>(DataSource);
  });

  afterAll(async () => {
    // Close the app and wait for all connections to be closed
    await app.close();
    
    // Close the data source explicitly
    if (dataSource && dataSource.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('should create an incident', async () => {
    const createIncidentDto: CreateIncidentDto = {
      message: 'Test incident',
      messengerType: MessengerType.Matrix,
      chain: Chain.Polkadot,
      blockNumber: 12345,
      wallet: testWallet,
      groupId: testGroup,
      handlerName: 'test-handler',
      channelId: 'test-channel',
      ackRequired: true,
      repeatIntervalHours: 24,
    };

    const response = await request(app.getHttpServer())
      .post('/incidents')
      .send(createIncidentDto)
      .expect(201);

    expect(response.body).toHaveProperty('id');
    expect(response.body.message).toBe(createIncidentDto.message);
    expect(response.body.chain).toBe(createIncidentDto.chain);
    expect(response.body.wallet).toBe(createIncidentDto.wallet);
    expect(response.body.groupId).toBe(createIncidentDto.groupId);
    expect(response.body.handlerName).toBe(createIncidentDto.handlerName);
    expect(response.body.channelId).toBe(createIncidentDto.channelId);
    expect(response.body.ackRequired).toBe(createIncidentDto.ackRequired);
    expect(response.body.repeatIntervalHours).toBe(createIncidentDto.repeatIntervalHours);
    expect(response.body.acked).toBe(false);
    expect(response.body.resolved).toBe(false);

    createdIncidentId = response.body.id;
  });

  it('should get all incidents', async () => {
    const response = await request(app.getHttpServer())
      .get('/incidents')
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(0);
  });

  it('should get unresolved incidents', async () => {
    const response = await request(app.getHttpServer())
      .get('/incidents?status=open')
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(0);
    expect(response.body[0].resolved).toBe(false);
  });

  it('should acknowledge an incident', async () => {
    const response = await request(app.getHttpServer())
      .post(`/incidents/${createdIncidentId}/acknowledge`)
      .send({
        username: 'test-user',
        channelId: 'test-channel',
      })
      .expect(201);

    expect(response.body.id).toBe(createdIncidentId);
    expect(response.body.acked).toBe(true);
    expect(response.body.ackedByUser).toBe('test-user');
    expect(response.body.ackedAt).toBeTruthy();
  });

  it('should get acknowledged incidents', async () => {
    const response = await request(app.getHttpServer())
      .get('/incidents?status=acked')
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(0);
    expect(response.body[0].acked).toBe(true);
    expect(response.body[0].resolved).toBe(false);
  });

  it('should resolve an incident', async () => {
    const response = await request(app.getHttpServer())
      .post(`/incidents/${createdIncidentId}/resolve`)
      .send({
        resolvedMessage: 'Test resolution',
      })
      .expect(201);

    expect(response.body.id).toBe(createdIncidentId);
    expect(response.body.resolved).toBe(true);
    expect(response.body.resolvedMessage).toBe('Test resolution');
    expect(response.body.resolvedAt).toBeTruthy();
  });

  it('should get resolved incidents', async () => {
    const response = await request(app.getHttpServer())
      .get('/incidents?status=resolved')
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(0);
    expect(response.body[0].resolved).toBe(true);
  });
});
