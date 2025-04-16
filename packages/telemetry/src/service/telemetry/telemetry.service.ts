import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '../config/config.service';
import { TelemetryClient, TelemetryData } from '@w3f/monitoring-types';
import { firstValueFrom } from 'rxjs';
import { Logger } from '@nestjs/common';

@Injectable()
export class TelemetryService implements TelemetryClient {
  private readonly logger = new Logger(TelemetryService.name);
  private readonly MAX_RETRIES = 3;
  private readonly endpoint: string;
  private readonly username?: string;
  private readonly password?: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly config: ConfigService,
  ) {
    const telemetryApi = this.config.getTelemetryExporterApi();
    this.endpoint = telemetryApi.url;
    this.username = telemetryApi.basicAuth?.username;
    this.password = telemetryApi.basicAuth?.password || process.env.TELEMETRY_PASSWORD;
  }

  async getTelemetry(): Promise<TelemetryData> {
    let attempt = 0;

    while (attempt < this.MAX_RETRIES) {
      try {
        const headers: Record<string, string> = {};

        if (this.username && this.password) {
          const auth = Buffer.from(`${this.username}:${this.password}`).toString('base64');
          headers['Authorization'] = `Basic ${auth}`;
        }

        const { data } = await firstValueFrom(this.httpService.get<TelemetryData>(this.endpoint, { headers }));

        if (attempt > 0) {
          this.logger.log('Successfully reconnected to telemetry API');
        }

        return data;
      } catch (error) {
        attempt++;

        if (attempt === this.MAX_RETRIES) {
          this.logger.error(
            `Failed to connect to telemetry API after all retry attempts: ${error.message}. Shutting down.`,
          );
          process.exit(1);
        }

        const delaySeconds = 3 * Math.pow(2, attempt - 1);
        this.logger.warn(
          `Connection attempt ${attempt}/${this.MAX_RETRIES} failed: ${error.message}. Retrying in ${delaySeconds}s...`,
        );
        await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));
      }
    }
  }
}
