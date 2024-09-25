import { NestFactory } from '@nestjs/core';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { Logger } from '@nestjs/common';

import { AppModule } from './app.module';
import { AppConfigService } from './config/app-config.service';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const appContext = await NestFactory.createApplicationContext(AppModule);
  const configService = appContext.get(AppConfigService);
  const redisConfig = configService.getRedisConfig();

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, {
    transport: Transport.REDIS,
    options: redisConfig,
  });

  await app.listen();
  logger.log(`Microservice is listening on Redis: ${redisConfig.host}:${redisConfig.port}, DB: ${redisConfig.db}`);
}

bootstrap().catch((error) => {
  console.error('Failed to start the microservice', error);
  process.exit(1);
});
