import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from './config/config.service';
import * as JSONbig from 'json-bigint';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { getLogLevels, buildOtelSdk } from '@w3f/polguard-common';
import * as pkg from '../package.json'; // "* as" import needed whilst we use commonJS

async function bootstrap() {
  const otelSdk = buildOtelSdk(pkg.name, pkg.version, false, true);
  otelSdk.start();

  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const logLevel = configService.getLoggingLevel();
  Logger.overrideLogger(getLogLevels(logLevel));

  const logger = new Logger('Main');

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    }),
  );

  // Override Express JSON serializer to handle BigInt
  app.use((req, res, next) => {
    res.json = function (body) {
      const jsonBody = JSONbig.stringify(body);
      res.setHeader('Content-Type', 'application/json');
      return res.send(jsonBody);
    };

    next();
  });

  // Setup Swagger
  const config = new DocumentBuilder()
    .setTitle('Monitoring API')
    .setDescription('The PolGuard API documentation')
    .setVersion('1.0')
    .addTag('incidents')
    .addTag('health')
    .addTag('metrics')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);

  // Get server configuration
  const serverConfig = configService.getServerConfig();

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
  logger.log(`Swagger documentation available at http://${serverConfig.host}:${serverConfig.port}/api-docs`);
}

bootstrap().catch(error => {
  console.error('Unhandled error during bootstrap:', error);
  process.exit(1);
});
