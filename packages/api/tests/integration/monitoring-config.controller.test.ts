import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { Chain } from '@w3f/monitoring-types';
import { MonitoringConfigService } from '../../src/monitoring-config/monitoring-config.service';
import { setupTestDatabase, createTestApp } from './test-utils';
import { DataSource } from 'typeorm';

describe('MonitoringConfigController (integration)', () => {
  let app: INestApplication;
  let monitoringConfigService: MonitoringConfigService;
  let dataSource: DataSource;
  
  // Test data
  const testChain = Chain.Polkadot;
  const testGroups = ['validators-default', 'validators-custom'];
  
  beforeAll(async () => {
    await setupTestDatabase();
    const { app: testApp, moduleFixture } = await createTestApp();
    app = testApp;
    monitoringConfigService = moduleFixture.get<MonitoringConfigService>(MonitoringConfigService);
    dataSource = moduleFixture.get<DataSource>(DataSource);
  });
  
  afterAll(async () => {
    await app.close();
    if (dataSource && dataSource.isInitialized) {
      await dataSource.destroy();
    }
  });
  
  describe('Monitoring configuration endpoints', () => {
    it('should retrieve monitoring groups with proper structure', async () => {
      const response = await request(app.getHttpServer())
        .get('/monitoring-config/groups')
        .query({ chain: testChain, groupIds: testGroups })
        .expect(200);
      
      expect(response.body).toHaveProperty('groups');
      expect(Array.isArray(response.body.groups)).toBe(true);
      expect(response.body.groups.length).toBeGreaterThan(0);
      
      // Verify group structure
      const group = response.body.groups[0];
      expect(group).toHaveProperty('id');
      expect(group).toHaveProperty('chain');
      expect(group).toHaveProperty('monitors');
      expect(group).toHaveProperty('accounts');
      expect(Array.isArray(group.accounts)).toBe(true);
    });
    
    it('should retrieve accounts for monitoring groups', async () => {
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
      
      // Verify account format (SS58 addresses)
      for (const groupId in response.body.accounts) {
        const accounts = response.body.accounts[groupId];
        if (accounts.length > 0) {
          expect(typeof accounts[0]).toBe('string');
        }
      }
    });
    
    it('should handle filtering and validation', async () => {
      // Test filtering by single group
      const singleGroup = testGroups[0];
      const filteredResponse = await request(app.getHttpServer())
        .get('/monitoring-config/groups')
        .query({ chain: testChain, groupIds: singleGroup })
        .expect(200);
      
      const groupIds = filteredResponse.body.groups.map(group => group.id);
      expect(groupIds).toContain(singleGroup);
      
      // Test empty groupIds (should return all groups)
      const allGroupsResponse = await request(app.getHttpServer())
        .get('/monitoring-config/groups')
        .query({ chain: testChain, groupIds: [] })
        .expect(200);
      
      expect(allGroupsResponse.body.groups.length).toBeGreaterThan(0);
      
      // Test invalid chain parameter
      await request(app.getHttpServer())
        .get('/monitoring-config/groups')
        .query({ chain: 'InvalidChain', groupIds: testGroups })
        .expect(400);
    });
  });
});
