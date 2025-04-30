import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { Chain } from '@w3f/monitoring-types';
import { DataSource } from 'typeorm';
import { setupTestDatabase, createTestApp } from './test-utils';

describe('MonitoringConfig API (integration)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  
  // Test data
  const testChain = Chain.Polkadot;
  const testGroups = ['validators-default', 'validators-custom'];
  
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
  
  describe('GET /monitoring-config/groups', () => {
    it('retrieves monitoring groups with proper structure', async () => {
      const response = await request(app.getHttpServer())
        .get('/monitoring-config/groups')
        .query({ chain: testChain, groupIds: testGroups })
        .expect(200);
      
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
      const singleGroup = testGroups[0];
      const response = await request(app.getHttpServer())
        .get('/monitoring-config/groups')
        .query({ chain: testChain, groupIds: singleGroup })
        .expect(200);
      
      const groupIds = response.body.groups.map(group => group.id);
      expect(groupIds).toContain(singleGroup);
      expect(groupIds.length).toBe(1);
    });
    
    it('returns all groups when no groupIds provided', async () => {
      const response = await request(app.getHttpServer())
        .get('/monitoring-config/groups')
        .query({ chain: testChain })
        .expect(200);
      
      expect(response.body.groups.length).toBeGreaterThan(0);
    });
    
    it('returns 400 for invalid chain parameter', async () => {
      await request(app.getHttpServer())
        .get('/monitoring-config/groups')
        .query({ chain: 'InvalidChain', groupIds: testGroups })
        .expect(400);
    });
  });
  
  describe('GET /monitoring-config/accounts', () => {
    it('retrieves accounts with proper structure', async () => {
      const response = await request(app.getHttpServer())
        .get('/monitoring-config/accounts')
        .query({ chain: testChain, groupIds: testGroups })
        .expect(200);
      
      expect(response.body).toHaveProperty('accounts');
      expect(typeof response.body.accounts).toBe('object');
      
      // Verify accounts structure
      const hasAccounts = Object.values(response.body.accounts).some(
        accounts => Array.isArray(accounts) && accounts.length > 0
      );
      expect(hasAccounts).toBe(true);
    });
    
    it('handles filtering by single group', async () => {
      const singleGroup = testGroups[0];
      const response = await request(app.getHttpServer())
        .get('/monitoring-config/accounts')
        .query({ chain: testChain, groupIds: singleGroup })
        .expect(200);
      
      const groupIds = Object.keys(response.body.accounts);
      expect(groupIds).toContain(singleGroup);
      expect(groupIds.length).toBe(1);
    });
    
    it('returns all accounts when no groupIds provided', async () => {
      const response = await request(app.getHttpServer())
        .get('/monitoring-config/accounts')
        .query({ chain: testChain })
        .expect(200);
      
      expect(Object.keys(response.body.accounts).length).toBeGreaterThan(0);
    });
    
    it('returns 400 for invalid chain parameter', async () => {
      await request(app.getHttpServer())
        .get('/monitoring-config/accounts')
        .query({ chain: 'InvalidChain', groupIds: testGroups })
        .expect(400);
    });
  });
});
