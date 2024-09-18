import { NestFactory } from '@nestjs/core';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';

import { AppModule } from './app.module';
import { AppConfigService } from './config-services/app-config.service';

async function bootstrap() {
  const appContext = await NestFactory.createApplicationContext(AppModule);
  const configService = appContext.get(AppConfigService);
  const rabbitMQConfig = configService.getRabbitMQConfig();

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.RMQ,
      options: {
        urls: [rabbitMQConfig.url],
        queue: rabbitMQConfig.queue,
        queueOptions: { durable: true },
      },
    },
  );

  await app.listen();
  console.log(`Microservice is listening on RabbitMQ queue: ${rabbitMQConfig.queue}`);
}

bootstrap().catch((error) => {
  console.error('Failed to start the microservice', error);
  process.exit(1);
});
