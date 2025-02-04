import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const httpPort = 3000;
  const logger = new Logger('Main');
  const app = await NestFactory.create(AppModule);

  process.on('SIGTERM', async () => {
    logger.log('SIGTERM signal received. Starting graceful shutdown...');
    await app.close();
    logger.log('Application closed');
  });

  logger.debug('Application created, starting initialization...');
  await app.init();
  await app.listen(httpPort);
  logger.log(`HTTP server is listening on port ${httpPort}`);
}

bootstrap().catch(error => {
  console.error('Unhandled error during bootstrap:', error);
  process.exit(1);
});
