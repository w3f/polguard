import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Chain, MessengerType } from '@w3f/monitoring-types';
import { AppModule } from '../../src/app.module';
import { Incident } from '../../src/database/incident.entity';
import { CreateIncidentDto } from '../../src/dto';
import { DataSource } from 'typeorm';

describe('IncidentController (e2e)', () => {
  jest.setTimeout(30000); // Increase timeout to 30 seconds
  let app: INestApplication;
  let dataSource: DataSource;
  let createdIncidentId: number;

  beforeAll(async () => {
    // Create a temporary connection to create/drop the test database
    const tempDataSource = new DataSource({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'postgres',
      password: 'postgres',
      database: 'postgres', // Connect to default postgres database
    });

    await tempDataSource.initialize();

    try {
      // Drop the test database if it exists
      await tempDataSource.query(`DROP DATABASE IF EXISTS incident_management_test`);
      // Create a fresh test database
      await tempDataSource.query(`CREATE DATABASE incident_management_test`);
    } catch (error) {
      console.error('Error setting up test database:', error);
    } finally {
      await tempDataSource.destroy();
    }

    // Now create the test module with the fresh test database
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: 'localhost',
          port: 5432,
          username: 'postgres',
          password: 'postgres',
          database: 'incident_management_test',
          entities: [Incident],
          synchronize: true, // Create tables based on entities
        }),
        AppModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({
      transform: true,
      whitelist: true,
    }));
    
    dataSource = moduleFixture.get<DataSource>(DataSource);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should create an incident', async () => {
    const createIncidentDto: CreateIncidentDto = {
      message: 'Test incident',
      messengerType: MessengerType.Matrix,
      chain: Chain.Polkadot,
      blockNumber: 12345,
      wallet: 'test-wallet',
      groupName: 'test-group',
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
    expect(response.body.groupName).toBe(createIncidentDto.groupName);
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
