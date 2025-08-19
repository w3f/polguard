import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { Chain, MessengerType, NotificationType } from '@w3f/monitoring-types';
import { DataSource } from 'typeorm';
import { cleanupTestDatabase, createTestApp } from './test-utils';
import { Incident } from '../../src/database/incident.entity';
import { LastBlock } from '../../src/database/last-block.entity';
import { Notification } from '../../src/database/notification.entity';
import { CreateIncidentDto } from '../../src/incident/dto';
import { IncidentService } from '../../src/incident/incident.service';

describe('Incident API (integration)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  const TEST_CHAIN = Chain.Polkadot;
  const TEST_ACCOUNT = '15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5';
  const TEST_GROUP_ID = 'validators-default';
  const TEST_CHANNEL_ID = '!testroom:matrix.org';
  const TEST_ESCALATION_CHANNEL_ID = '!escalation:matrix.org';
  const TEST_HANDLER_TYPE = 'SlashReportedEvent';
  const TEST_ESCALATION_TIMEOUT = 500;

  const createIncidentDto = (overrides: Partial<CreateIncidentDto> = {}): CreateIncidentDto => ({
    message: 'Test incident',
    chain: TEST_CHAIN,
    blockNumber: 1000,
    account: TEST_ACCOUNT,
    groupId: TEST_GROUP_ID,
    handlerType: TEST_HANDLER_TYPE,
    notificationChannels: [
      {
        channelId: TEST_CHANNEL_ID,
        messengerType: MessengerType.Matrix,
        repeatFiringMs: 3600,
      },
    ],
    needsAck: false,
    isResolved: false,
    idempotencyKey: 'test-key',
    ...overrides,
  });

  const createOneTimeIncident = (overrides: Partial<CreateIncidentDto> = {}) =>
    createIncidentDto({ isResolved: true, ...overrides });

  const createOngoingIncident = (overrides: Partial<CreateIncidentDto> = {}) =>
    createIncidentDto({ needsAck: true, isResolved: false, ...overrides });

  const postIncident = (dto: CreateIncidentDto) => request(app.getHttpServer()).post('/incidents').send(dto);

  const getIncident = (id: string) => request(app.getHttpServer()).get(`/incidents/${id}`);

  const acknowledgeIncident = (id: string, username = 'testuser', channelId = TEST_CHANNEL_ID) =>
    request(app.getHttpServer()).post(`/incidents/${id}/acknowledge`).send({ username, channelId });

  const resolveIncident = (id: string, blockNumber = 1000) =>
    request(app.getHttpServer()).post(`/incidents/${id}/resolve`).send({
      chain: TEST_CHAIN,
      blockNumber,
    });

  const setLastBlock = async (blockNumber: number) => {
    await dataSource.getRepository(LastBlock).save({
      chain: TEST_CHAIN,
      blockNumber,
    });
  };

  beforeAll(async () => {
    const { app: testApp, moduleFixture } = await createTestApp();
    app = testApp;
    dataSource = moduleFixture.get<DataSource>(DataSource);
  });

  afterAll(async () => {
    await app.close();
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
    cleanupTestDatabase();
  });

  beforeEach(async () => {
    // Clear in correct order due to foreign key constraints
    await dataSource.getRepository(Notification).clear();
    await dataSource.getRepository(Incident).clear();
    await dataSource.getRepository(LastBlock).clear();

    // Set default last block to same as default incident block number
    await setLastBlock(1000);
  });

  describe('POST /incidents - One-time incidents', () => {
    it('creates one-time incident successfully', async () => {
      const response = await postIncident(createOneTimeIncident()).expect(201);

      expect(response.body).toMatchObject({
        chain: TEST_CHAIN,
        account: TEST_ACCOUNT,
        isResolved: true,
        isAcked: false,
      });
      expect(response.body.id).toBeDefined();
      expect(response.body.resolvedAt).toBeDefined();
    });

    it('handles idempotency for same key and block', async () => {
      const dto = createOneTimeIncident({ idempotencyKey: 'same-key' });

      const first = await postIncident(dto).expect(201);
      const second = await postIncident(dto).expect(201);

      expect(first.body.id).toBe(second.body.id);
    });

    it('creates new incident for same key but different block', async () => {
      const baseDto = createOneTimeIncident({ idempotencyKey: 'same-key' });

      const first = await postIncident(baseDto).expect(201);
      const second = await postIncident({ ...baseDto, blockNumber: 2000 }).expect(201);

      expect(first.body.id).not.toBe(second.body.id);
      expect(second.body.blockNumber).toBe(2000);
    });

    it('validates required fields', async () => {
      await postIncident(createIncidentDto({ message: '', notificationChannels: [] })).expect(400);
    });

    it('updates last block', async () => {
      await postIncident(createOneTimeIncident({ blockNumber: 1500 })).expect(201);

      const lastBlock = await dataSource.getRepository(LastBlock).findOne({
        where: { chain: TEST_CHAIN },
      });
      expect(lastBlock?.blockNumber).toBe(1500);
    });
  });

  describe('POST /incidents - Ongoing incidents', () => {
    it('creates ongoing incident successfully', async () => {
      const response = await postIncident(createOngoingIncident()).expect(201);

      expect(response.body).toMatchObject({
        needsAck: true,
        isResolved: false,
        isAcked: false,
      });
      expect(response.body.resolvedAt).toBeNull();
    });

    it('handles idempotency for ongoing incidents', async () => {
      const dto = createOngoingIncident({ idempotencyKey: 'ongoing-key' });

      const first = await postIncident(dto).expect(201);
      const second = await postIncident(dto).expect(201);

      expect(first.body.id).toBe(second.body.id);
    });

    it('creates new incident after previous one resolved', async () => {
      const dto = createOngoingIncident({ idempotencyKey: 'resolve-test' });

      const first = await postIncident(dto).expect(201);
      await resolveIncident(first.body.id).expect(201);
      const second = await postIncident(dto).expect(201);

      expect(first.body.id).not.toBe(second.body.id);
    });
  });

  describe('POST /incidents/:id/acknowledge', () => {
    it('acknowledges incident successfully', async () => {
      const incident = await postIncident(createOngoingIncident()).expect(201);
      const response = await acknowledgeIncident(incident.body.id, 'testuser').expect(201);

      expect(response.body).toMatchObject({
        id: incident.body.id,
        isAcked: true,
        ackedBy: 'testuser',
      });
      expect(response.body.ackedAt).toBeDefined();
    });

    it('prevents acknowledgment from wrong channel', async () => {
      const incident = await postIncident(createOngoingIncident()).expect(201);
      await acknowledgeIncident(incident.body.id, 'testuser', '!wrong:matrix.org').expect(403);
    });

    it('returns 404 for non-existent incident', async () => {
      await acknowledgeIncident('non-existent-id').expect(404);
    });

    it('preserves original acker on multiple acknowledgments', async () => {
      const incident = await postIncident(createOngoingIncident()).expect(201);

      const first = await acknowledgeIncident(incident.body.id, 'user1').expect(201);
      const second = await acknowledgeIncident(incident.body.id, 'user2').expect(201);

      expect(first.body.ackedBy).toBe('user1');
      expect(second.body.ackedBy).toBe('user1');
      expect(first.body.ackedAt).toBe(second.body.ackedAt);
    });
  });

  describe('Last block validation', () => {
    it('allows block equal to last block', async () => {
      await postIncident(createOneTimeIncident({ blockNumber: 1000 })).expect(201);
    });

    it('allows block greater than last block and updates it', async () => {
      await postIncident(createOneTimeIncident({ blockNumber: 1500 })).expect(201);

      const lastBlock = await dataSource.getRepository(LastBlock).findOne({
        where: { chain: TEST_CHAIN },
      });
      expect(lastBlock?.blockNumber).toBe(1500);
    });

    it('rejects block less than last block with 409', async () => {
      // Set last block to 1500
      await setLastBlock(1500);

      // Try to create incident with block 999 (less than 1500)
      await postIncident(createOneTimeIncident({ blockNumber: 999 })).expect(409);
    });

    it('allows resolving with same block number', async () => {
      const incident = await postIncident(createOngoingIncident()).expect(201);
      await resolveIncident(incident.body.id, 1000).expect(201);
    });

    it('allows resolving with greater block and updates last block', async () => {
      const incident = await postIncident(createOngoingIncident()).expect(201);
      await resolveIncident(incident.body.id, 1200).expect(201);

      const lastBlock = await dataSource.getRepository(LastBlock).findOne({
        where: { chain: TEST_CHAIN },
      });
      expect(lastBlock?.blockNumber).toBe(1200);
    });

    it('rejects resolving with block less than last block with 409', async () => {
      await setLastBlock(1500);

      const incident = await postIncident(createOngoingIncident({ blockNumber: 1500 })).expect(201);

      // Try to resolve with block 999 (less than 1500)
      await resolveIncident(incident.body.id, 999).expect(409);
    });
  });

  describe('GET /incidents', () => {
    beforeEach(async () => {
      await postIncident(
        createOneTimeIncident({
          idempotencyKey: 'resolved',
          message: 'Resolved incident',
        }),
      );
      await postIncident(
        createOngoingIncident({
          idempotencyKey: 'unresolved-ack',
          message: 'Unresolved needing ack',
        }),
      );
      await postIncident(
        createIncidentDto({
          idempotencyKey: 'unresolved-no-ack',
          message: 'Unresolved not needing ack',
        }),
      );
    });

    it('retrieves all incidents without filters', async () => {
      const response = await request(app.getHttpServer()).get('/incidents').expect(200);
      expect(response.body).toHaveLength(3);
    });

    it('filters by resolution status', async () => {
      const resolved = await request(app.getHttpServer()).get('/incidents').query({ isResolved: true }).expect(200);
      const unresolved = await request(app.getHttpServer()).get('/incidents').query({ isResolved: false }).expect(200);

      expect(resolved.body).toHaveLength(1);
      expect(unresolved.body).toHaveLength(2);
    });

    it('filters by acknowledgment requirement', async () => {
      const needsAck = await request(app.getHttpServer()).get('/incidents').query({ needsAck: true }).expect(200);

      expect(needsAck.body).toHaveLength(1);
      expect(needsAck.body[0].message).toBe('Unresolved needing ack');
    });

    it('filters by chain and account', async () => {
      const byChain = await request(app.getHttpServer()).get('/incidents').query({ chain: TEST_CHAIN }).expect(200);
      const byAccount = await request(app.getHttpServer())
        .get('/incidents')
        .query({ account: TEST_ACCOUNT })
        .expect(200);

      expect(byChain.body).toHaveLength(3);
      expect(byAccount.body).toHaveLength(3);
    });
  });

  describe('GET /incidents/:id', () => {
    it('retrieves incident by ID', async () => {
      const created = await postIncident(createIncidentDto()).expect(201);
      const retrieved = await getIncident(created.body.id).expect(200);

      expect(retrieved.body).toMatchObject({
        id: created.body.id,
        message: 'Test incident',
        chain: TEST_CHAIN,
        account: TEST_ACCOUNT,
      });
      expect(retrieved.body.notifications).toBeDefined();
    });

    it('returns 404 for non-existent incident', async () => {
      await getIncident('non-existent-id').expect(404);
    });
  });

  describe('POST /incidents/:id/resolve', () => {
    it('resolves incident successfully', async () => {
      const incident = await postIncident(createOngoingIncident()).expect(201);
      const resolved = await resolveIncident(incident.body.id).expect(201);

      expect(resolved.body).toMatchObject({
        id: incident.body.id,
        isResolved: true,
      });
      expect(resolved.body.resolvedAt).toBeDefined();
    });

    it('handles already resolved incident', async () => {
      const incident = await postIncident(createOneTimeIncident()).expect(201);
      const resolved = await resolveIncident(incident.body.id).expect(201);

      expect(resolved.body.isResolved).toBe(true);
    });

    it('returns 404 for non-existent incident', async () => {
      await resolveIncident('non-existent-id').expect(404);
    });
  });

  describe('Escalation functionality', () => {
    it('creates incident with escalation channels successfully', async () => {
      const response = await postIncident(
        createIncidentDto({
          needsAck: true,
          escalationChannels: [
            {
              channelId: TEST_ESCALATION_CHANNEL_ID,
              messengerType: MessengerType.Matrix,
            },
          ],
          escalationTimeoutMs: TEST_ESCALATION_TIMEOUT,
        }),
      ).expect(201);

      expect(response.body.escalationChannels[0]).toMatchObject({
        channelId: TEST_ESCALATION_CHANNEL_ID,
        messengerType: MessengerType.Matrix,
      });
    });

    it(
      'escalates unacknowledged incidents after timeout',
      async () => {
        const incident = await postIncident(
          createIncidentDto({
            needsAck: true,
            escalationChannels: [
              {
                channelId: TEST_ESCALATION_CHANNEL_ID,
                messengerType: MessengerType.Matrix,
              },
            ],
            escalationTimeoutMs: TEST_ESCALATION_TIMEOUT,
          }),
        ).expect(201);
        const incidentService = app.get(IncidentService);

        await new Promise(resolve => setTimeout(resolve, TEST_ESCALATION_TIMEOUT + 500));
        await incidentService.escalateIncidents();

        const notifications = await dataSource.getRepository(Notification).find({
          where: { incident: { id: incident.body.id } },
        });

        const escalationNotifications = notifications.filter(n => n.type === NotificationType.Escalation);
        expect(escalationNotifications).toHaveLength(1);
        expect(escalationNotifications[0].channelId).toBe(TEST_ESCALATION_CHANNEL_ID);
      },
      TEST_ESCALATION_TIMEOUT + 1000,
    );

    it(
      'does not send escalation twice for the same incident',
      async () => {
        const incident = await postIncident(
          createIncidentDto({
            needsAck: true,
            escalationChannels: [
              {
                channelId: TEST_ESCALATION_CHANNEL_ID,
                messengerType: MessengerType.Matrix,
              },
            ],
            escalationTimeoutMs: TEST_ESCALATION_TIMEOUT,
          }),
        ).expect(201);
        const incidentService = app.get(IncidentService);

        // Wait for escalation timeout and escalate first time
        await new Promise(resolve => setTimeout(resolve, TEST_ESCALATION_TIMEOUT + 500));
        await incidentService.escalateIncidents();
        // Try to escalate again
        await incidentService.escalateIncidents();

        const notifications = await dataSource.getRepository(Notification).find({
          where: { incident: { id: incident.body.id } },
        });

        const escalationNotifications = notifications.filter(n => n.type === NotificationType.Escalation);
        expect(escalationNotifications).toHaveLength(1);
        expect(escalationNotifications[0].channelId).toBe(TEST_ESCALATION_CHANNEL_ID);
      },
      TEST_ESCALATION_TIMEOUT + 1500,
    );
  });

  describe('Auto-resolve orphaned incidents', () => {
    it('does nothing when no active accounts (safety check)', async () => {
      await postIncident(
        createOngoingIncident({
          account: 'orphaned-account',
          idempotencyKey: 'orphaned',
        }),
      ).expect(201);

      const incidentService = app.get(IncidentService);
      const resolvedCount = await incidentService.autoResolveOrphanedIncidents([]);

      expect(resolvedCount).toBe(0);

      const incidents = await request(app.getHttpServer()).get('/incidents').query({ isResolved: false }).expect(200);
      expect(incidents.body).toHaveLength(1);
    });

    // TODO: Add comprehensive tests for auto-resolve orphaned incidents
  });
});
