import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import { MicroserviceOptions } from '@nestjs/microservices';
import { ConfigService } from './config/config.service';
import { RedisStreamsServer } from '@w3f/nest-redis-streams';

async function bootstrap() {
  const httpPort = 3000;
  const logger = new Logger('Main');
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const redisConfig = configService.getRedisConfig();

  const microservice = app.connectMicroservice<MicroserviceOptions>({
    strategy: new RedisStreamsServer({
      host: redisConfig.host,
      port: redisConfig.port,
      streamName: 'incidents',
      groupName: 'incident-management',
      consumerName: 'incident-management',
    }),
  });

  logger.debug('Application created, starting initialization...');
  await app.init();
  await app.listen(httpPort);
  logger.log(`HTTP server is listening on port ${httpPort}`);
  await microservice.listen();
  logger.log('Microservice is ready to consume events from Redis Streams');
}

bootstrap().catch(error => {
  console.error('Unhandled error during bootstrap:', error);
  process.exit(1);
});
