import Fastify, { FastifyInstance } from 'fastify';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import pino from 'pino';
import { HttpError } from '@w3f/polguard-common';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import * as schema from '../../src/database/schema';
import { notifications, incidents, lastBlocks } from '../../src/database/schema';
import type { Database } from '../../src/database/db';
import { ConfigService } from '../../src/config/config.service';
import { LastBlockService } from '../../src/last-block/last-block.service';
import { NotificationService } from '../../src/notification/notification.service';
import { IncidentService } from '../../src/incident/incident.service';
import { incidentRoutes } from '../../src/routes/incident.routes';
import { lastBlockRoutes } from '../../src/routes/last-block.routes';
import * as path from 'path';

const silentLogger = pino({ level: 'silent' });

function createMockConfigService(): ConfigService {
  return {
    getDatabaseConfig: () => ({}),
    getNotificationConfig: () => ({
      matrix: { url: 'http://mock-matrix-server/api/notify' },
    }),
    getLoggingLevel: () => 'silent',
    getEnvironment: () => 'test',
    getServerConfig: () => ({ port: 0, host: '127.0.0.1' }),
    getCronsConfig: () => ({}),
  } as unknown as ConfigService;
}

export interface TestContext {
  app: FastifyInstance;
  db: Database;
  pool: pg.Pool;
  container: StartedPostgreSqlContainer;
  incidentService: IncidentService;
  notificationService: NotificationService;
  lastBlockService: LastBlockService;
}

export async function createTestApp(): Promise<TestContext> {
  // Start a real PostgreSQL container
  const container = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('test_incidents')
    .withUsername('test')
    .withPassword('test')
    .start();

  // Connect using node-postgres
  const pool = new pg.Pool({
    connectionString: container.getConnectionUri(),
  });

  const db = drizzle(pool, { schema }) as unknown as Database;

  // Apply Drizzle migrations (uses the existing drizzle/ migration files)
  const migrationsFolder = path.join(__dirname, '..', '..', 'drizzle');
  await migrate(db, { migrationsFolder });

  // Wire services
  const config = createMockConfigService();
  const lastBlockService = new LastBlockService(db);

  // Mock the notification sending (we don't want real HTTP calls in tests)
  const notificationService = new NotificationService(db, config, silentLogger);
  (notificationService as any).send = vi.fn().mockResolvedValue(true);

  const incidentService = new IncidentService(db, notificationService, silentLogger);

  // Build Fastify app
  const app = Fastify({ logger: false });

  app.setErrorHandler((error: Error & { validation?: unknown; statusCode?: number }, _request, reply) => {
    if (error instanceof HttpError) {
      reply.status(error.status).send({ statusCode: error.status, message: error.message });
    } else if (error.validation) {
      reply.status(400).send({ statusCode: 400, message: error.message });
    } else {
      reply.status(500).send({ statusCode: 500, message: 'Internal Server Error' });
    }
  });

  await app.register(incidentRoutes(incidentService));
  await app.register(lastBlockRoutes(lastBlockService));

  await app.ready();

  return { app, db, pool, container, incidentService, notificationService, lastBlockService };
}

export async function clearTables(ctx: TestContext): Promise<void> {
  // Clear in correct order due to foreign key constraints
  await ctx.db.delete(notifications);
  await ctx.db.delete(incidents);
  await ctx.db.delete(lastBlocks);
}

export async function destroyTestApp(ctx: TestContext): Promise<void> {
  if (!ctx) return;
  await ctx.app?.close();
  await ctx.pool?.end();
  await ctx.container?.stop();
}
