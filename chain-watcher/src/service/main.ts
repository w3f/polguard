import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const httpPort = 3000;
  const logger = new Logger('Main');
  const app = await NestFactory.create(AppModule);
  
  logger.debug('Application created, starting initialization...');
  await app.init();
  await app.listen(httpPort);
  logger.log(`HTTP server is listening on port ${httpPort}`);
  
  logger.log('Application initialized successfully');
  logger.log('Microservice is ready to emit events');
}

bootstrap().catch((error) => {
  console.error('Unhandled error during bootstrap:', error);
  process.exit(1);
});

