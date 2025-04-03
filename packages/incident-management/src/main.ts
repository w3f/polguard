import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from './config/config.service';

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
