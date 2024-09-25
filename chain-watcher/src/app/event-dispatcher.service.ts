import { Injectable, Logger } from '@nestjs/common';
import { ClientProxy, ClientProxyFactory, Transport } from '@nestjs/microservices';
import { EventDispatcher, Incident } from '@core/interfaces';
import { AppConfigService } from './config/app-config.service';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class EventDispatcherService implements EventDispatcher {
  private client: ClientProxy;
  private logger = new Logger(EventDispatcherService.name);

  private readonly MAX_RETRIES = 3;
  private readonly INITIAL_DELAY = 2000; // 2 second

  constructor(private configService: AppConfigService) {
    const redisConfig = this.configService.getRedisConfig();
    this.client = ClientProxyFactory.create({
      transport: Transport.REDIS,
      options: redisConfig,
    });
  }

  async emitIncident(incident: Incident): Promise<void> {
    for (let attempt = 0; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        await firstValueFrom(this.client.emit('incident', incident));
        this.logger.log(`Successfully emitted incident: ${incident.message}`);
        return;
      } catch (error) {
        if (attempt === this.MAX_RETRIES) {
          const errorMessage = `Failed to emit incident after ${this.MAX_RETRIES} attempts. Incident: ${incident.message}`;
          this.logger.error(errorMessage, error);
          throw new Error(errorMessage);
        }

        const delay = this.INITIAL_DELAY * Math.pow(2, attempt);
        this.logger.warn(`Attempt ${attempt + 1} failed to emit incident: ${incident.message}. Retrying in ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
}
