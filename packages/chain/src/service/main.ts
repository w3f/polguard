import { createRequire } from 'node:module';
import Fastify from 'fastify';
import { buildOtelSdk, createRootLogger } from '@w3f/polguard-common';
import { ConfigService } from './config/config.service';
import { createStore } from './store/factory';
import { createReporter } from './reporter/factory';
import { ChainTelemetryService } from './telemetry/chain-telemetry.service';
import { WatcherService } from './watcher/watcher.service';

const require = createRequire(import.meta.url);
const pkg = require('../package.json') as { name: string; version: string };

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
  const store = createStore(config, rootLogger.child({ context: 'Store' }));
  const reporter = createReporter(config, rootLogger.child({ context: 'Reporter' }));
  const telemetry = new ChainTelemetryService(config.getChain());

  // Watcher
  const watcher = new WatcherService(rootLogger.child({ context: 'Watcher' }), config, telemetry, store, reporter);

  // Fastify server (health endpoint)
  const serverConfig = config.getServerConfig();
  const app = Fastify({ logger: false });
  app.get('/health', async () => ({ status: 'ok' }));
  await app.listen({ port: serverConfig.port, host: serverConfig.host });
  logger.info(`HTTP server listening on ${serverConfig.host}:${serverConfig.port}`);

  // Graceful shutdown (declared before the fatal handlers so they can reuse it)
  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`${signal} received. Starting graceful shutdown...`);
    await watcher.stop();
    (store as any).destroy?.();
    await app.close();
    await otelSdk.shutdown();
    logger.info('Application closed');
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Safety net: an unhandled rejection / uncaught exception (e.g. a connection rebuild that fails
  // because every RPC is down) should exit cleanly for the orchestrator to restart, not hang.
  const fatal = (kind: string) => (error: unknown) => {
    logger.error(`Fatal ${kind}: ${(error as Error)?.stack ?? String(error)}. Exiting...`);
    const timeout = new Promise(resolve => setTimeout(resolve, 5000));
    Promise.race([shutdown(kind), timeout]).finally(() => process.exit(1));
  };
  process.on('unhandledRejection', fatal('unhandledRejection'));
  process.on('uncaughtException', fatal('uncaughtException'));

  // Start watcher
  await watcher.start();
  logger.info('Application initialized successfully');
}

bootstrap().catch(error => {
  console.error('Unhandled error during bootstrap:', error);
  process.exit(1);
});
