import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import { ConfigService } from './config/config.service';
import { getLogLevels } from '@w3f/monitoring-types';
import { buildOtelSdk } from '@w3f/monitoring-telemetry';
import * as pkg from '../../package.json'; // "* as" import needed whilst we use commonJS

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const logLevel = configService.getLoggingLevel();
  Logger.overrideLogger(getLogLevels(logLevel));

  const logger = new Logger('Main');
  const serverConfig = configService.getServerConfig();

  const otelSdk = buildOtelSdk(pkg.name, pkg.version, undefined, false, true);
  otelSdk.start();

  logger.debug('Application created, starting initialization...');
  await app.init();
  await app.listen(serverConfig.port, serverConfig.host);
  logger.log(`HTTP server is listening on ${serverConfig.host}:${serverConfig.port}`);
}

bootstrap().catch(error => {
  console.error('Unhandled error during bootstrap:', error);
  process.exit(1);
});
