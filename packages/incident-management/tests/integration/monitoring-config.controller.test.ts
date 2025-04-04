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
    // Setup test database
    await setupTestDatabase();
    
    // Create test app with shared fixture
    const { app: testApp, moduleFixture } = await createTestApp();
    app = testApp;
    
    monitoringConfigService = moduleFixture.get<MonitoringConfigService>(MonitoringConfigService);
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
  
  it('should get monitoring groups', async () => {
    const response = await request(app.getHttpServer())
      .get('/monitoring-config/groups')
      .query({ chain: testChain, groupIds: testGroups })
      .expect(200);
    
    expect(response.body).toHaveProperty('groups');
    expect(Array.isArray(response.body.groups)).toBe(true);
    expect(response.body.groups.length).toBeGreaterThan(0); // At least one group should be returned
    
    // Verify the structure of the returned groups
    const group = response.body.groups[0];
    expect(group).toHaveProperty('name');
    expect(group).toHaveProperty('chain');
    expect(group).toHaveProperty('monitors');
    expect(group).toHaveProperty('accounts');
    expect(Array.isArray(group.accounts)).toBe(true);
  });
  
  it('should get accounts for groups', async () => {
    const response = await request(app.getHttpServer())
      .get('/monitoring-config/accounts')
      .query({ chain: testChain, groupIds: testGroups })
      .expect(200);
    
    expect(response.body).toHaveProperty('accounts');
    expect(typeof response.body.accounts).toBe('object');
    
    // Verify the structure of the returned accounts
    expect(typeof response.body.accounts).toBe('object');
    
    // At least one group should have accounts
    const hasAccounts = Object.values(response.body.accounts).some(
      accounts => Array.isArray(accounts) && accounts.length > 0
    );
    expect(hasAccounts).toBe(true);
    
    // Verify that accounts are strings (SS58 addresses)
    for (const groupId in response.body.accounts) {
      const accounts = response.body.accounts[groupId];
      if (accounts.length > 0) {
        expect(typeof accounts[0]).toBe('string');
      }
    }
  });
  
  it('should return only the requested groups', async () => {
    // Request only one of the test groups
    const singleGroup = testGroups[0];
    
    const queryString = `chain=${testChain}&groupIds[]=${singleGroup}`;
    
    const response = await request(app.getHttpServer())
      .get(`/monitoring-config/groups?${queryString}`)
      .expect(200);
    
    expect(response.body).toHaveProperty('groups');
    expect(Array.isArray(response.body.groups)).toBe(true);
    
    // Verify that only the requested group is returned
    const groupNames = response.body.groups.map(group => group.name);
    expect(groupNames).toContain(singleGroup);
    
    // Verify that the other test group is not returned
    const otherGroup = testGroups.find(g => g !== singleGroup);
    if (otherGroup) {
      expect(groupNames).not.toContain(otherGroup);
    }
  });
  
  it('should validate input and return 400 for invalid requests', async () => {
    await request(app.getHttpServer())
      .get('/monitoring-config/groups')
      .query({ chain: testChain, groupIds: [] }) // Empty array should fail validation
      .expect(400);
  });
  
  it('should validate chain parameter and return 400 for invalid chain', async () => {
    await request(app.getHttpServer())
      .get('/monitoring-config/groups')
      .query({ chain: 'InvalidChain', groupIds: testGroups })
      .expect(400);
  });
});
