import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { AppModule } from '../../src/app.module';
import { ConfigService } from '../../src/config/config.service';
import { HttpService } from '@nestjs/axios';
import { of } from 'rxjs';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as JSONbig from 'json-bigint';
import { Incident } from '../../src/database/incident.entity';
import { Notification } from '../../src/database/notification.entity';
import { LastBlock } from '../../src/database/last-block.entity';

const workerId = process.env.JEST_WORKER_ID ?? '0'; // "0" when runInBand
export const dbFile = path.join(process.cwd(), `test-${workerId}.sqlite`);

/**
 * Cleanup function to remove the SQLite database file for the current worker
 */
export function cleanupTestDatabase(): void {
  if (fs.existsSync(dbFile)) {
    fs.unlinkSync(dbFile);
  }
}

const SQLITE_TEST_CONFIG = {
  type: 'better-sqlite3' as const,
  database: dbFile,
  dropSchema: true,
  synchronize: true,
  keepConnectionAlive: true,
  entities: [Incident, Notification, LastBlock],
  namingStrategy: new SnakeNamingStrategy(),
  extra: { pragmas: ['foreign_keys=ON'] },
};

export async function createTestApp(): Promise<{
  app: INestApplication;
  moduleFixture: TestingModule;
}> {
  // Create the test module
  const moduleFixture = await Test.createTestingModule({
    imports: [
      TypeOrmModule.forRootAsync({
        useFactory: () => SQLITE_TEST_CONFIG,
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
          url: 'http://mock-matrix-server/api/notify',
        },
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
          data: { success: true },
        });
      }),
    })
    .compile();

  const app = moduleFixture.createNestApplication();

  // Apply global pipes
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    }),
  );

  // Override Express JSON serializer to handle BigInt (same as in main.ts)
  app.use((req, res, next) => {
    res.json = function (body) {
      const jsonBody = JSONbig.stringify(body);
      res.setHeader('Content-Type', 'application/json');
      return res.send(jsonBody);
    };

    next();
  });

  await app.init();

  return { app, moduleFixture };
}
