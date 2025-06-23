import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '../config/config.service';
import { firstValueFrom } from 'rxjs';
import { Chain, MessengerType } from '@w3f/monitoring-types';
import { MonitoringConfigServiceInterface } from '@lib/interfaces';

export interface AccountsResponse {
  accounts: Record<string, string[]>;
}

@Injectable()
export class MonitoringConfigService implements MonitoringConfigServiceInterface {
  private readonly logger = new Logger(MonitoringConfigService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async getAccounts(chain: Chain, channelId: string): Promise<Record<string, string[]>> {
    const { baseUrl, endpoints } = this.configService.getMonitoringApi();
    const url = `${baseUrl}${endpoints.getAccounts}`;
    const response = await firstValueFrom(
      this.httpService.get<AccountsResponse>(url, {
        params: {
          chain,
          messengerType: MessengerType.Matrix,
          channelId,
        },
      }),
    );
    return response.data.accounts;
  }
}
