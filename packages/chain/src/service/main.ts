import { createRequire } from 'node:module';
import Fastify from 'fastify';
import { buildOtelSdk } from '@w3f/polguard-common';
import { ConfigService } from './config/config.service';
import { createRootLogger } from './logger';
import { createStore } from './store/factory';
import { createReporter } from './reporter/factory';
import { ChainTelemetryService } from './telemetry/chain-telemetry.service';
import { WatcherService } from './watcher/watcher.service';

const require = createRequire(import.meta.url);
const pkg = require('../../package.json') as { name: string; version: string };

async function bootstrap() {
  // 1. Telemetry
  const otelSdk = buildOtelSdk(pkg.name, pkg.version, false, true);
  otelSdk.start();

  // 2. Config (uses a temporary debug-level logger for initial load)
  const bootLogger = createRootLogger('debug');
  const config = new ConfigService(bootLogger.child({ context: 'Config' }));

  // 3. Create the root logger at the configured level
  const rootLogger = createRootLogger(config.getLoggingLevel());
  const logger = rootLogger.child({ context: 'Main' });

  // 4. Wire dependencies
  const store = createStore(config, rootLogger.child({ context: 'Store' }));
  const reporter = createReporter(config, rootLogger.child({ context: 'Reporter' }));
  const telemetry = new ChainTelemetryService(config.getChain());

  // 5. Watcher
  const watcher = new WatcherService(rootLogger.child({ context: 'Watcher' }), config, telemetry, store, reporter);

  // 6. Fastify server (health endpoint)
  const serverConfig = config.getServerConfig();
  const app = Fastify({ logger: false });
  app.get('/health', async () => ({ status: 'ok' }));
  await app.listen({ port: serverConfig.port, host: serverConfig.host });
  logger.info(`HTTP server listening on ${serverConfig.host}:${serverConfig.port}`);

  // 7. Start watcher
  await watcher.start();
  logger.info('Application initialized successfully');

  // 8. Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`${signal} received. Starting graceful shutdown...`);
    await watcher.stop();
    (store as any).destroy?.();
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
