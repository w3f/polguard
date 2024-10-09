import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Main');
  const app = await NestFactory.create(AppModule);
  
  logger.log('Application created, starting initialization...');
  
  await app.init();
  
  logger.log('Application initialized successfully');
  logger.log('Microservice is ready to emit events');
}
bootstrap();
