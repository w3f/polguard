import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import { LastBlockClient, Chain } from '@w3f/monitoring-types';
import { ConfigService } from '../config/config.service';

@Injectable()
export class LastBlockService implements LastBlockClient {
  private readonly getUrl: string;
  private readonly setUrl: string;

  constructor(
    private readonly logger: Logger,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    const monitoringApi = this.configService.getMonitoringApi();
    const { baseUrl, endpoints } = monitoringApi;
    this.getUrl = `${baseUrl}${endpoints.getLastBlock}`;
    this.setUrl = `${baseUrl}${endpoints.setLastBlock}`;
  }

  async getLastBlock(chain: Chain): Promise<number | null> {
    try {
      const url = this.getUrl.replace(':chain', chain);
      const response = await lastValueFrom(this.httpService.get(url));

      if (response.status >= 200 && response.status < 300) {
        return response.data?.blockNumber || null;
      }
    } catch (error) {
      this.logger.error(`Failed to get last block for chain ${chain}: ${error.message}`);
      throw new Error(`Failed to get last block: ${error.message}`);
    }

    return null;
  }

  async setLastBlock(chain: Chain, blockNumber: number): Promise<void> {
    try {
      const response = await lastValueFrom(this.httpService.post(this.setUrl, { chain, blockNumber }));

      if (response.status >= 200 && response.status < 300) {
        return;
      }
    } catch (error) {
      if (error.response?.status === 409) {
        this.logger.debug(`Block ${blockNumber} already processed for chain ${chain}, skipping`);
        return;
      }

      this.logger.error(`Failed to set last block for chain ${chain}: ${error.message}`);
    }
  }
}
