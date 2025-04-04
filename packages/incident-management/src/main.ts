import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from './config/config.service';
import JSONbig from 'json-bigint';

async function bootstrap() {
  const logger = new Logger('Main');
  const app = await NestFactory.create(AppModule);

  // Apply validation pipe
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

  // Get server configuration
  const configService = app.get(ConfigService);
  const serverConfig = configService.getServerConfig();

  logger.debug('Application created, starting initialization...');
  await app.init();
  await app.listen(serverConfig.port, serverConfig.host);
  logger.log(`HTTP server is listening on ${serverConfig.host}:${serverConfig.port}`);
}

bootstrap().catch(error => {
  console.error('Unhandled error during bootstrap:', error);
  process.exit(1);
});
