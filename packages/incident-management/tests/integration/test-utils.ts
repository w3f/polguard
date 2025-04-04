import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { MonitoringConfigService } from '../../src/monitoring-config/monitoring-config.service';
import { ConfigService } from '../../src/config/config.service';
import { HttpService } from '@nestjs/axios';
import * as path from 'path';
import * as fs from 'fs';
import { of } from 'rxjs';

/**
 * Sets up a test database for integration tests
 */
export async function setupTestDatabase(): Promise<void> {
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
    await tempDataSource.query(`DROP DATABASE IF EXISTS incident_management_test`);
    await tempDataSource.query(`CREATE DATABASE incident_management_test`);
  } catch (error) {
    console.error('Error setting up test database:', error);
  } finally {
    await tempDataSource.destroy();
  }
}

/**
 * Creates a test fixture for monitoring groups using a YAML file
 * @param service The MonitoringConfigService instance
 * @param fixturePath Path to the YAML fixture file (defaults to the shared test fixture)
 */
export async function setupMonitoringConfigService(
  service: MonitoringConfigService, 
  fixturePath: string = path.join(__dirname, './fixtures/test-config.yaml')
): Promise<void> {
  // Get the configsDir from the service
  const configsDir = path.join(process.cwd(), 'monitoring-configs');
  
  // Create the directory if it doesn't exist
  if (!fs.existsSync(configsDir)) {
    fs.mkdirSync(configsDir, { recursive: true });
  }
  
  // Copy our test fixture to the configsDir
  const fixtureContent = fs.readFileSync(fixturePath, 'utf8');
  const targetPath = path.join(configsDir, 'test-config.yaml');
  fs.writeFileSync(targetPath, fixtureContent);
  
  // Now let the service refresh configurations normally
  // It will find our test fixture in the configsDir
  await service.refreshConfigurations();
}

/**
 * Creates a NestJS application for integration tests
 * @param fixtureOptions Options for configuring test fixtures (optional)
 */
export async function createTestApp(fixtureOptions?: {
  monitoringConfigFixturePath?: string;
}): Promise<{
  app: INestApplication;
  moduleFixture: TestingModule;
}> {
  // Create the test module
  const moduleFixture = await Test.createTestingModule({
    imports: [
      AppModule,
    ],
  })
  .overrideProvider(ConfigService)
  .useValue({
    getMonitoringConfigSources: jest.fn().mockReturnValue([]),
    getDatabaseConfig: jest.fn().mockReturnValue({
      host: 'localhost',
      port: 5432,
      username: 'postgres',
      password: 'postgres',
      database: 'incident_management_test',
    }),
    getNotificationConfig: jest.fn().mockReturnValue({
      matrix: {
        url: 'http://mock-matrix-server/api/notify'
      }
    }),
    getLoggingLevel: jest.fn().mockReturnValue('info'),
    getEnvironment: jest.fn().mockReturnValue('test'),
  })
  .overrideProvider(HttpService)
  .useValue({
    post: jest.fn().mockReturnValue(of({ data: {} })),
  })
  .compile();

  const app = moduleFixture.createNestApplication();
  
  // Apply global pipes
  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
  }));
  
  // Get the MonitoringConfigService to inject our test data
  const monitoringConfigService = moduleFixture.get<MonitoringConfigService>(MonitoringConfigService);
  
  // Setup the monitoring config service with test data
  await setupMonitoringConfigService(
    monitoringConfigService, 
    fixtureOptions?.monitoringConfigFixturePath
  );
  
  await app.init();
  
  return { app, moduleFixture };
}
