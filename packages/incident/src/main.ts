import { createRequire } from 'node:module';
import Fastify from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import pino from 'pino';
import { buildOtelSdk, HttpError } from '@w3f/polguard-common';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { ConfigService } from './config/config.service';
import { createDatabase } from './database/db';
import { LastBlockService } from './last-block/last-block.service';
import { NotificationService } from './notification/notification.service';
import { IncidentService } from './incident/incident.service';
import { SchedulerService } from './scheduler/scheduler.service';
import { incidentRoutes } from './routes/incident.routes';
import { lastBlockRoutes } from './routes/last-block.routes';

const require = createRequire(import.meta.url);
const pkg = require('../package.json') as { name: string; version: string };

function createRootLogger(level: string, isDev: boolean): pino.Logger {
  return pino({
    level,
    ...(isDev
      ? { transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss.l' } } }
      : {}),
  });
}

async function bootstrap() {
  // Telemetry
  const otelSdk = buildOtelSdk(pkg.name, pkg.version, false, true);
  otelSdk.start();

  // Config (uses a temporary debug-level logger for initial load)
  const bootLogger = createRootLogger('debug', true);
  const config = new ConfigService(bootLogger.child({ context: 'Config' }));

  // Create the root logger at the configured level
  const isDev = config.getEnvironment() !== 'production';
  const rootLogger = createRootLogger(config.getLoggingLevel(), isDev);
  const logger = rootLogger.child({ context: 'Main' });

  // Database
  const dbConfig = config.getDatabaseConfig();
  const db = createDatabase({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.username,
    password: dbConfig.password,
    database: dbConfig.database,
  });

  // Run migrations
  await migrate(db, { migrationsFolder: './drizzle' });
  logger.info('Database migrations applied');

  // Wire services
  const lastBlockService = new LastBlockService(db);
  const notificationService = new NotificationService(db, config, rootLogger.child({ context: 'Notification' }));
  const incidentService = new IncidentService(
    db,
    notificationService,
    lastBlockService,
    rootLogger.child({ context: 'Incident' }),
  );

  // Scheduler (cron jobs)
  const schedulerService = new SchedulerService(
    config,
    notificationService,
    incidentService,
    rootLogger.child({ context: 'Scheduler' }),
  );
  schedulerService.start();

  // Fastify server
  const serverConfig = config.getServerConfig();
  const app = Fastify({ logger: false });

  // Swagger
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Incident Service',
        description: 'REST API for incident lifecycle management',
        version: pkg.version,
      },
    },
  });
  await app.register(swaggerUi, { routePrefix: '/docs' });

  // Error handler: map HttpError subclasses to proper HTTP responses
  app.setErrorHandler((error: Error & { validation?: unknown; statusCode?: number }, _request, reply) => {
    if (error instanceof HttpError) {
      reply.status(error.status).send({ statusCode: error.status, message: error.message });
    } else if (error.validation) {
      reply.status(400).send({ statusCode: 400, message: error.message });
    } else {
      logger.error(error, 'Unhandled error');
      reply.status(500).send({ statusCode: 500, message: 'Internal Server Error' });
    }
  });

  // Health
  app.get('/health', async () => ({ status: 'ok' }));

  // Routes
  await app.register(incidentRoutes(incidentService));
  await app.register(lastBlockRoutes(lastBlockService));

  await app.listen({ port: serverConfig.port, host: serverConfig.host });
  logger.info(`HTTP server listening on ${serverConfig.host}:${serverConfig.port}`);
  logger.info('Application initialized successfully');

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`${signal} received. Starting graceful shutdown...`);
    schedulerService.stop();
    await app.close();
    await otelSdk.shutdown();
    logger.info('Application closed');
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch(error => {
  console.error('Unhandled error during bootstrap:', error);
  process.exit(1);
});
