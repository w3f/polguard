import { Chain, MessengerType, NotificationType, ResolutionType } from '@w3f/polguard-common';
import { createTestApp, clearTables, destroyTestApp, TestContext } from './test-utils';
import type { CreateIncidentBody } from '../../src/schemas/incident.schemas';
import { incidents, notifications } from '../../src/database/schema';
import { eq } from 'drizzle-orm';

describe('Incident API (integration)', () => {
  let ctx: TestContext;

  const TEST_CHAIN = Chain.Polkadot;
  const TEST_ACCOUNT = '15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5';
  const TEST_GROUP_ID = 'validators-default';
  const TEST_CHANNEL_ID = '!testroom:matrix.org';
  const TEST_ESCALATION_CHANNEL_ID = '!escalation:matrix.org';
  const TEST_HANDLER_TYPE = 'OffenceReportedEvent';
  const TEST_ESCALATION_TIMEOUT = 500;

  const createIncidentDto = (overrides: Partial<CreateIncidentBody> = {}): CreateIncidentBody => ({
    content: { condition: 'Test incident', details: [] },
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

  const createOneTimeIncident = (overrides: Partial<CreateIncidentBody> = {}) =>
    createIncidentDto({ isResolved: true, ...overrides });

  const createOngoingIncident = (overrides: Partial<CreateIncidentBody> = {}) =>
    createIncidentDto({ needsAck: true, isResolved: false, ...overrides });

  const postIncident = (dto: CreateIncidentBody) => ctx.app.inject({ method: 'POST', url: '/incidents', payload: dto });

  const getIncident = (id: string) => ctx.app.inject({ method: 'GET', url: `/incidents/${id}` });

  const acknowledgeIncident = (id: string, username = 'testuser', channelId = TEST_CHANNEL_ID) =>
    ctx.app.inject({ method: 'POST', url: `/incidents/${id}/acknowledge`, payload: { username, channelId } });

  const resolveIncident = (
    id: string,
    blockNumber = 1000,
    content: { condition: string; details: string[] } = { condition: 'Test resolution', details: [] },
  ) =>
    ctx.app.inject({
      method: 'POST',
      url: `/incidents/${id}/resolve`,
      payload: { chain: TEST_CHAIN, blockNumber, content },
    });

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await destroyTestApp(ctx);
  });

  beforeEach(async () => {
    await clearTables(ctx);
  });

  // --- Helpers ---
  const parseBody = (res: any) => JSON.parse(res.body);

  describe('POST /incidents - One-time incidents', () => {
    it('creates one-time incident successfully', async () => {
      const res = await postIncident(createOneTimeIncident());
      expect(res.statusCode).toBe(201);
      const body = parseBody(res);
      expect(body).toMatchObject({
        chain: TEST_CHAIN,
        account: TEST_ACCOUNT,
        isResolved: true,
        isAcked: false,
      });
      expect(body.id).toBeDefined();
      expect(body.resolvedAt).toBeDefined();
    });

    it('handles idempotency for same key', async () => {
      const dto = createOneTimeIncident({ idempotencyKey: 'same-key' });
      const first = await postIncident(dto);
      const second = await postIncident(dto);
      expect(first.statusCode).toBe(201);
      expect(second.statusCode).toBe(201);
      expect(parseBody(first).id).toBe(parseBody(second).id);
    });

    it('validates required fields', async () => {
      const res = await postIncident(createIncidentDto({ notificationChannels: [] }));
      expect(res.statusCode).toBe(400);
    });
  });

  describe('POST /incidents - Ongoing incidents', () => {
    it('creates ongoing incident successfully', async () => {
      const res = await postIncident(createOngoingIncident());
      expect(res.statusCode).toBe(201);
      const body = parseBody(res);
      expect(body).toMatchObject({
        needsAck: true,
        isResolved: false,
        isAcked: false,
      });
      expect(body.resolvedAt).toBeNull();
    });

    it('handles idempotency for ongoing incidents', async () => {
      const dto = createOngoingIncident({ idempotencyKey: 'ongoing-key' });
      const first = await postIncident(dto);
      const second = await postIncident(dto);
      expect(parseBody(first).id).toBe(parseBody(second).id);
    });

    it('creates new incident after previous one resolved', async () => {
      const dto = createOngoingIncident({ idempotencyKey: 'resolve-test' });
      const first = await postIncident(dto);
      expect(first.statusCode).toBe(201);
      const resolveRes = await resolveIncident(parseBody(first).id);
      expect(resolveRes.statusCode).toBe(200);
      const second = await postIncident(dto);
      expect(second.statusCode).toBe(201);
      expect(parseBody(first).id).not.toBe(parseBody(second).id);
    });
  });

  describe('Notification delivery', () => {
    const sendMock = () => (ctx.notificationService as any).send as ReturnType<typeof vi.fn>;

    const notificationsFor = (incidentId: string) =>
      ctx.db.select().from(notifications).where(eq(notifications.incidentId, incidentId));

    afterEach(() => {
      sendMock().mockResolvedValue(true);
    });

    it('returns before delivery completes and delivers in the background', async () => {
      let release: () => void = () => {};
      const sent = new Promise<boolean>(resolve => (release = () => resolve(true)));
      sendMock().mockImplementationOnce(() => sent);

      const res = await postIncident(createOngoingIncident());
      expect(res.statusCode).toBe(201);
      const incidentId = parseBody(res).id;

      // The request completed while the send is still in flight.
      expect((await notificationsFor(incidentId))[0].isDelivered).toBe(false);

      release();
      await vi.waitFor(async () => {
        expect((await notificationsFor(incidentId))[0].isDelivered).toBe(true);
      });
    });

    it('keeps a failed notification pending instead of losing it', async () => {
      sendMock().mockResolvedValue(false);

      const incidentId = parseBody(await postIncident(createOngoingIncident())).id;

      await vi.waitFor(async () => {
        expect((await notificationsFor(incidentId))[0].lastSentAt).not.toBeNull();
      });
      expect((await notificationsFor(incidentId))[0].isDelivered).toBe(false);
    });

    it('retries a failed notification once its backoff has elapsed', async () => {
      sendMock().mockResolvedValue(false);

      const incidentId = parseBody(await postIncident(createOngoingIncident())).id;
      await vi.waitFor(async () => {
        expect((await notificationsFor(incidentId))[0].lastSentAt).not.toBeNull();
      });

      // Age the failed attempt past the retry backoff.
      await ctx.db
        .update(notifications)
        .set({ lastSentAt: new Date(Date.now() - 60 * 60 * 1000) })
        .where(eq(notifications.incidentId, incidentId));

      sendMock().mockResolvedValue(true);
      await ctx.notificationService.deliver();

      expect((await notificationsFor(incidentId))[0].isDelivered).toBe(true);
    });
  });

  describe('POST /incidents/:id/acknowledge', () => {
    it('acknowledges incident successfully', async () => {
      const incident = parseBody(await postIncident(createOngoingIncident()));
      const res = await acknowledgeIncident(incident.id, 'testuser');
      expect(res.statusCode).toBe(200);
      const body = parseBody(res);
      expect(body).toMatchObject({
        id: incident.id,
        isAcked: true,
        ackedBy: 'testuser',
      });
      expect(body.ackedAt).toBeDefined();
    });

    it('prevents acknowledgment from wrong channel', async () => {
      const incident = parseBody(await postIncident(createOngoingIncident()));
      const res = await acknowledgeIncident(incident.id, 'testuser', '!wrong:matrix.org');
      expect(res.statusCode).toBe(403);
    });

    it('returns 404 for non-existent incident', async () => {
      const res = await acknowledgeIncident('non-existent-id');
      expect(res.statusCode).toBe(404);
    });

    it('preserves original acker on multiple acknowledgments', async () => {
      const incident = parseBody(await postIncident(createOngoingIncident()));
      const first = parseBody(await acknowledgeIncident(incident.id, 'user1'));
      const second = parseBody(await acknowledgeIncident(incident.id, 'user2'));
      expect(first.ackedBy).toBe('user1');
      expect(second.ackedBy).toBe('user1');
      expect(first.ackedAt).toBe(second.ackedAt);
    });
  });

  describe('GET /incidents', () => {
    beforeEach(async () => {
      await postIncident(
        createOneTimeIncident({ idempotencyKey: 'resolved', content: { condition: 'Resolved incident', details: [] } }),
      );
      await postIncident(
        createOngoingIncident({
          idempotencyKey: 'unresolved-ack',
          content: { condition: 'Unresolved needing ack', details: [] },
        }),
      );
      await postIncident(
        createIncidentDto({
          idempotencyKey: 'unresolved-no-ack',
          content: { condition: 'Unresolved not needing ack', details: [] },
        }),
      );
    });

    it('retrieves all incidents without filters', async () => {
      const res = await ctx.app.inject({ method: 'GET', url: '/incidents' });
      expect(res.statusCode).toBe(200);
      expect(parseBody(res)).toHaveLength(3);
    });

    it('filters by resolution status', async () => {
      const resolved = parseBody(await ctx.app.inject({ method: 'GET', url: '/incidents?isResolved=true' }));
      const unresolved = parseBody(await ctx.app.inject({ method: 'GET', url: '/incidents?isResolved=false' }));
      expect(resolved).toHaveLength(1);
      expect(unresolved).toHaveLength(2);
    });

    it('filters by acknowledgment requirement', async () => {
      const needsAck = parseBody(await ctx.app.inject({ method: 'GET', url: '/incidents?needsAck=true' }));
      expect(needsAck).toHaveLength(1);
      expect(needsAck[0].content.condition).toBe('Unresolved needing ack');
    });

    it('filters by chain and account', async () => {
      const byChain = parseBody(await ctx.app.inject({ method: 'GET', url: `/incidents?chain=${TEST_CHAIN}` }));
      const byAccount = parseBody(await ctx.app.inject({ method: 'GET', url: `/incidents?account=${TEST_ACCOUNT}` }));
      expect(byChain).toHaveLength(3);
      expect(byAccount).toHaveLength(3);
    });
  });

  describe('GET /incidents/:id', () => {
    it('retrieves incident by ID', async () => {
      const created = parseBody(await postIncident(createIncidentDto()));
      const res = await getIncident(created.id);
      expect(res.statusCode).toBe(200);
      const body = parseBody(res);
      expect(body).toMatchObject({
        id: created.id,
        content: { condition: 'Test incident', details: [] },
        chain: TEST_CHAIN,
        account: TEST_ACCOUNT,
      });
      expect(body.notifications).toBeDefined();
    });

    it('returns 404 for non-existent incident', async () => {
      const res = await getIncident('non-existent-id');
      expect(res.statusCode).toBe(404);
    });
  });

  describe('POST /incidents/:id/resolve', () => {
    it('resolves incident successfully', async () => {
      const incident = parseBody(await postIncident(createOngoingIncident()));
      const res = await resolveIncident(incident.id);
      expect(res.statusCode).toBe(200);
      const body = parseBody(res);
      expect(body).toMatchObject({ id: incident.id, isResolved: true });
      expect(body.resolvedAt).toBeDefined();
    });

    it('handles already resolved incident', async () => {
      const incident = parseBody(await postIncident(createOneTimeIncident()));
      const res = await resolveIncident(incident.id);
      expect(res.statusCode).toBe(200);
      expect(parseBody(res).isResolved).toBe(true);
    });

    it('returns 404 for non-existent incident', async () => {
      const res = await resolveIncident('non-existent-id');
      expect(res.statusCode).toBe(404);
    });
  });

  describe('Escalation functionality', () => {
    it('creates incident with escalation channels successfully', async () => {
      const res = await postIncident(
        createIncidentDto({
          needsAck: true,
          escalationChannels: [{ channelId: TEST_ESCALATION_CHANNEL_ID, messengerType: MessengerType.Matrix }],
          escalationTimeoutMs: TEST_ESCALATION_TIMEOUT,
        }),
      );
      expect(res.statusCode).toBe(201);
      const body = parseBody(res);
      const channels = body.escalationChannels;
      expect(channels[0]).toMatchObject({
        channelId: TEST_ESCALATION_CHANNEL_ID,
        messengerType: MessengerType.Matrix,
      });
    });

    it(
      'escalates unacknowledged incidents after timeout',
      async () => {
        const incident = parseBody(
          await postIncident(
            createIncidentDto({
              needsAck: true,
              escalationChannels: [{ channelId: TEST_ESCALATION_CHANNEL_ID, messengerType: MessengerType.Matrix }],
              escalationTimeoutMs: TEST_ESCALATION_TIMEOUT,
            }),
          ),
        );

        await new Promise(resolve => setTimeout(resolve, TEST_ESCALATION_TIMEOUT + 500));
        await ctx.incidentService.escalateIncidents();

        const notifs = await ctx.db.select().from(notifications).where(eq(notifications.incidentId, incident.id));

        const escalationNotifs = notifs.filter(n => n.type === NotificationType.Escalation);
        expect(escalationNotifs).toHaveLength(2);

        expect(escalationNotifs.find(n => n.channelId === TEST_ESCALATION_CHANNEL_ID)).toBeDefined();
        expect(escalationNotifs.find(n => n.channelId === TEST_CHANNEL_ID)).toBeDefined();
      },
      TEST_ESCALATION_TIMEOUT + 1000,
    );

    it(
      'does not send escalation twice for the same incident',
      async () => {
        const incident = parseBody(
          await postIncident(
            createIncidentDto({
              needsAck: true,
              escalationChannels: [{ channelId: TEST_ESCALATION_CHANNEL_ID, messengerType: MessengerType.Matrix }],
              escalationTimeoutMs: TEST_ESCALATION_TIMEOUT,
            }),
          ),
        );

        await new Promise(resolve => setTimeout(resolve, TEST_ESCALATION_TIMEOUT + 500));
        await ctx.incidentService.escalateIncidents();
        await ctx.incidentService.escalateIncidents();

        const notifs = await ctx.db.select().from(notifications).where(eq(notifications.incidentId, incident.id));

        const escalationNotifs = notifs.filter(n => n.type === NotificationType.Escalation);
        expect(escalationNotifs).toHaveLength(2);
      },
      TEST_ESCALATION_TIMEOUT + 1500,
    );
  });

  describe('Auto resolution', () => {
    it('auto-resolves stale incidents after 30 days', async () => {
      const incident = parseBody(await postIncident(createOngoingIncident()));

      const thirtyOneDaysAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
      await ctx.db.update(incidents).set({ createdAt: thirtyOneDaysAgo }).where(eq(incidents.id, incident.id));

      await ctx.incidentService.autoResolveStaleIncidents();

      const resolved = await ctx.db.query.incidents.findFirst({
        where: eq(incidents.id, incident.id),
      });

      expect(resolved).toMatchObject({
        isResolved: true,
        resolutionType: ResolutionType.AutoTimeout,
      });
      expect(resolved?.resolvedAt).toBeDefined();
    });
  });

  describe('POST /incidents/:id/resolve-manual', () => {
    const resolveIncidentManually = (id: string, username = 'testuser', channelId = TEST_CHANNEL_ID) =>
      ctx.app.inject({ method: 'POST', url: `/incidents/${id}/resolve-manual`, payload: { username, channelId } });

    it('resolves incident manually successfully', async () => {
      const incident = parseBody(await postIncident(createOngoingIncident()));
      const res = await resolveIncidentManually(incident.id, 'testuser');
      expect(res.statusCode).toBe(200);
      const body = parseBody(res);
      expect(body).toMatchObject({
        id: incident.id,
        isResolved: true,
        resolutionType: ResolutionType.Manual,
        resolvedBy: 'testuser',
      });
      expect(body.resolvedAt).toBeDefined();
    });

    it('prevents manual resolution from wrong channel', async () => {
      const incident = parseBody(await postIncident(createOngoingIncident()));
      const res = await resolveIncidentManually(incident.id, 'testuser', '!wrong:matrix.org');
      expect(res.statusCode).toBe(403);
    });

    it('returns 404 for non-existent incident', async () => {
      const res = await resolveIncidentManually('non-existent-id');
      expect(res.statusCode).toBe(404);
    });

    it('handles already resolved incident', async () => {
      const incident = parseBody(await postIncident(createOneTimeIncident()));
      const res = await resolveIncidentManually(incident.id);
      expect(res.statusCode).toBe(200);
      expect(parseBody(res).isResolved).toBe(true);
    });
  });

  describe('Resolution types', () => {
    it('sets ChainService resolution type for chain-resolved incidents', async () => {
      const incident = parseBody(await postIncident(createOngoingIncident()));
      const res = await resolveIncident(incident.id);
      const body = parseBody(res);
      expect(body.resolutionType).toBe(ResolutionType.ChainService);
      expect(body.resolvedBy).toBeNull();
    });

    it('sets ChainService resolution type for one-time incidents', async () => {
      const body = parseBody(await postIncident(createOneTimeIncident()));
      expect(body.resolutionType).toBe(ResolutionType.ChainService);
      expect(body.resolvedBy).toBeNull();
    });

    it('sets Manual resolution type for manually resolved incidents', async () => {
      const incident = parseBody(await postIncident(createOngoingIncident()));
      const res = await ctx.app.inject({
        method: 'POST',
        url: `/incidents/${incident.id}/resolve-manual`,
        payload: { username: 'testuser', channelId: TEST_CHANNEL_ID },
      });
      const body = parseBody(res);
      expect(body.resolutionType).toBe(ResolutionType.Manual);
      expect(body.resolvedBy).toBe('testuser');
    });
  });
});
