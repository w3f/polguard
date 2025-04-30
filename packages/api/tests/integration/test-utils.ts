import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppModule } from '../../src/app.module';
import { MonitoringConfigService } from '../../src/monitoring-config/monitoring-config.service';
import { ConfigService } from '../../src/config/config.service';
import { HttpService } from '@nestjs/axios';
import { of } from 'rxjs';
import * as path from 'path';
import * as fs from 'fs';
import { Incident, IncidentNotification } from '../../src/database/incident.entities';

const workerId = process.env.JEST_WORKER_ID ?? '0';          // "0" when runInBand
export const dbFile   = path.join(process.cwd(), `test-${workerId}.sqlite`);

const SQLITE_TEST_CONFIG = {
  type: 'better-sqlite3' as const,
  database: dbFile,
  dropSchema: true,
  synchronize: true,
  keepConnectionAlive: true,
  entities: [Incident, IncidentNotification],
  extra: { pragmas: ['foreign_keys=ON'] },
};

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
  
  // The service refreshes configurations normally
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
      TypeOrmModule.forRootAsync({
        useFactory: () => (SQLITE_TEST_CONFIG),
      }),
      AppModule,
    ],
  })
  .overrideProvider(ConfigService)
  .useValue({
    getMonitoringConfigSources: jest.fn().mockReturnValue([]),
    getDatabaseConfig: jest.fn().mockReturnValue(SQLITE_TEST_CONFIG),
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
    post: jest.fn().mockImplementation(() => {
      return of({
        status: 200,
        statusText: 'OK',
        data: { success: true }
      });
    })
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
