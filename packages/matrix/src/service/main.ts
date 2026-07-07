import { createRequire } from 'node:module';
import Fastify from 'fastify';
import pino from 'pino';
import { buildOtelSdk } from '@w3f/polguard-common';
import { ConfigService } from './config.service';
import { IncidentService } from './incident.service';
import { MatrixBot } from '../lib/matrix-bot';

const require = createRequire(import.meta.url);
const pkg = require('../package.json') as { name: string; version: string };

function createRootLogger(level: string): pino.Logger {
  return pino({
    level,
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'SYS:HH:MM:ss.l' },
    },
  });
}

async function bootstrap() {
  // Telemetry
  const otelSdk = buildOtelSdk(pkg.name, pkg.version, false, true);
  otelSdk.start();

  // Config (uses a temporary debug-level logger for initial load)
  const bootLogger = createRootLogger('debug');
  const config = new ConfigService(bootLogger.child({ context: 'Config' }));

  // Create the root logger at the configured level
  const rootLogger = createRootLogger(config.getLoggingLevel());
  const logger = rootLogger.child({ context: 'Main' });

  // Wire dependencies
  const incidentService = new IncidentService(
    config.getIncidentsUrl(),
    rootLogger.child({ context: 'IncidentService' }),
  );

  const matrixConfig = config.getMatrixConfig();

  const bot = new MatrixBot(matrixConfig, rootLogger.child({ context: 'MatrixBot' }), incidentService);
  await bot.init();

  // Fastify server
  const serverConfig = config.getServerConfig();
  const app = Fastify({ logger: false });

  app.get('/health', async () => ({ status: 'ok' }));

  app.post('/notifications', async request => {
    const { channelId, message } = request.body as { channelId: string; message: string };
    logger.info(`Received notification request for channel ${channelId}`);
    await bot.sendMessage(channelId, message);
    return { success: true };
  });

  await app.listen({ port: serverConfig.port, host: serverConfig.host });
  logger.info(`HTTP server listening on ${serverConfig.host}:${serverConfig.port}`);

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`${signal} received. Starting graceful shutdown...`);
    await bot.stop();
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
