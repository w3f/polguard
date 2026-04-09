import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import { ConfigService } from './config/config.service';
import { getLogLevels, buildOtelSdk } from '@w3f/polguard-common';
import * as pkg from '../../package.json'; // "* as" import needed whilst we use commonJS

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const logLevel = configService.getLoggingLevel();
  Logger.overrideLogger(getLogLevels(logLevel));

  const logger = new Logger('Main');
  const serverConfig = configService.getServerConfig();

  const otelSdk = buildOtelSdk(pkg.name, pkg.version, false, true);
  otelSdk.start();

  // Handle graceful shutdown
  process.on('SIGTERM', async () => {
    logger.log('SIGTERM signal received. Starting graceful shutdown...');
    await app.close();
    await otelSdk.shutdown();
    logger.log('Application closed');
  });

  logger.debug('Application created, starting initialization...');
  await app.init();
  await app.listen(serverConfig.port, serverConfig.host);
  logger.log(`HTTP server is listening on ${serverConfig.host}:${serverConfig.port}`);
}

bootstrap().catch(error => {
  console.error('Unhandled error during bootstrap:', error);
  process.exit(1);
});
