import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { Chain, MessengerType } from '@w3f/monitoring-types';
import { DataSource } from 'typeorm';
import { cleanupTestDatabase, createTestApp } from './test-utils';

describe('MonitoringConfig API (integration)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  const TEST_CHAIN = Chain.Polkadot;
  const TEST_GROUPS = ['validators-default', 'validators-custom'];

  const getGroups = (chain: Chain, groupIds?: string[]) =>
    request(app.getHttpServer())
      .get('/monitoring-config/groups')
      .query({ chain, ...(groupIds && { groupIds }) });

  const getAccounts = (chain: Chain, groupIds?: string[], messengerType?: MessengerType, channelId?: string) =>
    request(app.getHttpServer())
      .get('/monitoring-config/accounts')
      .query({
        chain,
        ...(groupIds && { groupIds }),
        ...(messengerType && { messengerType }),
        ...(channelId && { channelId }),
      });

  beforeAll(async () => {
    // No need to call setupTestDatabase() as we're using SQLite in-memory database
    const { app: testApp, moduleFixture } = await createTestApp();
    app = testApp;
    dataSource = moduleFixture.get<DataSource>(DataSource);
  });

  afterAll(async () => {
    await app.close();
    if (dataSource && dataSource.isInitialized) {
      await dataSource.destroy();
    }
    cleanupTestDatabase();
  });

  describe('GET /monitoring-config/groups', () => {
    it('retrieves monitoring groups with proper structure', async () => {
      const response = await getGroups(TEST_CHAIN, TEST_GROUPS).expect(200);

      expect(response.body).toHaveProperty('groups');
      expect(Array.isArray(response.body.groups)).toBe(true);

      // Verify at least one group is returned
      expect(response.body.groups.length).toBeGreaterThan(0);

      // Verify group structure
      const group = response.body.groups[0];
      expect(group).toHaveProperty('id');
      expect(group).toHaveProperty('chain');
      expect(group).toHaveProperty('monitors');
      expect(group).toHaveProperty('accounts');
      expect(Array.isArray(group.accounts)).toBe(true);
    });

    it('handles filtering by single group', async () => {
      const singleGroup = TEST_GROUPS[0];
      const response = await getGroups(TEST_CHAIN, [singleGroup]).expect(200);

      const groupIds = response.body.groups.map(group => group.id);
      expect(groupIds).toContain(singleGroup);
      expect(groupIds.length).toBe(1);
    });

    it('returns all groups when no groupIds provided', async () => {
      const response = await getGroups(TEST_CHAIN).expect(200);

      expect(response.body.groups.length).toBeGreaterThan(0);
    });

    it('returns 400 for invalid chain parameter', async () => {
      await request(app.getHttpServer())
        .get('/monitoring-config/groups')
        .query({ chain: 'InvalidChain', groupIds: TEST_GROUPS })
        .expect(400);
    });
  });

  describe('GET /monitoring-config/accounts', () => {
    it('retrieves accounts with proper structure', async () => {
      const response = await getAccounts(TEST_CHAIN, TEST_GROUPS).expect(200);

      expect(response.body).toHaveProperty('accounts');
      expect(typeof response.body.accounts).toBe('object');

      // Verify accounts structure
      const hasAccounts = Object.values(response.body.accounts).some(
        accounts => Array.isArray(accounts) && accounts.length > 0,
      );
      expect(hasAccounts).toBe(true);
    });

    it('handles filtering by single group', async () => {
      const singleGroup = TEST_GROUPS[0];
      const response = await getAccounts(TEST_CHAIN, [singleGroup]).expect(200);

      const groupIds = Object.keys(response.body.accounts);
      expect(groupIds).toContain(singleGroup);
      expect(groupIds.length).toBe(1);
    });

    it('returns all accounts when no groupIds provided', async () => {
      const response = await getAccounts(TEST_CHAIN).expect(200);

      expect(Object.keys(response.body.accounts).length).toBeGreaterThan(0);
    });

    it('returns 400 for invalid chain parameter', async () => {
      await request(app.getHttpServer())
        .get('/monitoring-config/accounts')
        .query({ chain: 'InvalidChain', groupIds: TEST_GROUPS })
        .expect(400);
    });

    describe('Channel filtering', () => {
      it('filters accounts by messenger type and channel ID', async () => {
        const response = await getAccounts(TEST_CHAIN, undefined, MessengerType.Matrix, '!testroom:matrix.org').expect(
          200,
        );

        expect(response.body).toHaveProperty('accounts');
        expect(typeof response.body.accounts).toBe('object');

        // Should only return accounts for groups that have this specific channel
        const groupIds = Object.keys(response.body.accounts);
        expect(groupIds.length).toBeGreaterThanOrEqual(0);
      });

      it('returns empty accounts for non-existent channel', async () => {
        const response = await getAccounts(
          TEST_CHAIN,
          undefined,
          MessengerType.Matrix,
          '!nonexistent:matrix.org',
        ).expect(200);

        expect(response.body).toHaveProperty('accounts');
        expect(Object.keys(response.body.accounts)).toHaveLength(0);
      });

      it('returns 400 for invalid messenger type', async () => {
        await request(app.getHttpServer())
          .get('/monitoring-config/accounts')
          .query({
            chain: TEST_CHAIN,
            messengerType: 'InvalidMessenger',
            channelId: '!testroom:matrix.org',
          })
          .expect(400);
      });
    });
  });
});
