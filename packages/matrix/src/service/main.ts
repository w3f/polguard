import { createRequire } from 'node:module';
import { buildOtelSdk, createRootLogger } from '@w3f/polguard-common';
import { ConfigService } from './config.service';
import { IncidentService } from './incident.service';
import { buildServer } from './server';
import { MatrixBot } from '../lib/matrix-bot';
import { MatrixClient } from '../lib/matrix-client';

const require = createRequire(import.meta.url);
const pkg = require('../package.json') as { name: string; version: string };

async function bootstrap() {
  const otelSdk = buildOtelSdk(pkg.name, pkg.version, false, true);
  otelSdk.start();

  const bootLogger = createRootLogger('debug');
  const config = new ConfigService(bootLogger.child({ context: 'Config' }));

  const rootLogger = createRootLogger(config.getLoggingLevel());
  const logger = rootLogger.child({ context: 'Main' });

  const matrixConfig = config.getMatrixConfig();
  const incidentsUrl = config.getIncidentsUrl();
  const client = incidentsUrl
    ? new MatrixBot(
        matrixConfig,
        rootLogger.child({ context: 'MatrixBot' }),
        new IncidentService(incidentsUrl, rootLogger.child({ context: 'IncidentService' })),
      )
    : new MatrixClient(matrixConfig, rootLogger.child({ context: 'MatrixClient' }));
  logger.info(incidentsUrl ? 'Incident service configured: bot commands enabled' : 'No incident service: sending only');
  await client.init();

  const serverConfig = config.getServerConfig();
  const app = buildServer(client, rootLogger.child({ context: 'Server' }));
  await app.listen({ port: serverConfig.port, host: serverConfig.host });
  logger.info(`HTTP server listening on ${serverConfig.host}:${serverConfig.port}`);

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received. Starting graceful shutdown...`);
    await client.stop();
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
