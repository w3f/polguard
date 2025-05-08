import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import {
  MonitoringGroup,
  MonitoringConfigClient,
  MonitorType,
  MessengerType,
  StakingHandlerType as H,
  MonitorTypeSettings,
} from '@w3f/monitoring-types';
import { ConfigService } from '../config/config.service';
import { MetricsService } from '../metrics/metrics.service';

@Injectable()
export class MonitoringConfigService implements MonitoringConfigClient {
  constructor(
    private readonly logger: Logger,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly metrics: MetricsService,
  ) {}

  async getMonitoringGroups(): Promise<MonitoringGroup[]> {
    const monitoringApi = this.configService.getMonitoringApi();
    const configUrl = `${monitoringApi.baseUrl}${monitoringApi.endpoints.getConfig}`;
    const groupIds = this.configService.getMonitoringGroupIds();

    let response;

    try {
      response = await lastValueFrom(
        this.httpService.get(configUrl, {
          params: {
            chain: this.configService.getChain(),
            groupIds: groupIds.join(','),
          },
        }),
      );
    } catch (error) {
      this.logger.error(`Failed to fetch monitoring groups from api service: ${error.message}`);

      // In development environment, use hardcoded groups
      if (this.configService.getEnvironment() === 'development') {
        this.logger.warn('Using hardcoded monitoring groups for development environment');
        return this.getDevMonitoringGroups();
      }

      throw new Error(`Failed to fetch monitoring groups: ${error.message}`);
    }

    const groups = response.data.groups;

    // Validate that we received the expected number of groups
    if (groups.length !== groupIds.length) {
      throw new Error(`Expected ${groupIds.length} monitoring groups but received ${groups.length}`);
    }

    // Validate that all requested group IDs are present
    const receivedGroupIds = groups.map(group => group.id);
    const missingGroupIds = groupIds.filter(id => !receivedGroupIds.includes(id));

    if (missingGroupIds.length > 0) {
      throw new Error(`Missing monitoring groups: ${missingGroupIds.join(', ')}`);
    }

    // Log detailed information and update metrics
    this.logGroupDetails(groups);
    this.updateMetrics(groups);

    return groups;
  }

  private logGroupDetails(groups: MonitoringGroup[]): void {
    this.logger.log(`Fetched ${groups.length} monitoring groups from api service:`);

    // Log details for each group
    for (const group of groups) {
      const accountCount = group.accounts?.length || 0;
      const monitorNames = group.monitors.map(m => m.name).join(', ');

      this.logger.log(`  Group: ${group.id} (${accountCount} accounts) - Monitors: [${monitorNames}]`);
    }

    // Calculate and log summary metrics
    const totalAccounts = groups.reduce((acc, group) => acc + (group.accounts?.length || 0), 0);
    const monitorTypes = new Set<string>();
    groups.forEach(group => group.monitors.forEach(monitor => monitorTypes.add(monitor.name)));

    this.logger.log(
      `Summary: ${groups.length} groups with ${totalAccounts} accounts and ${monitorTypes.size} monitor types (${Array.from(monitorTypes).join(', ')})`,
    );
  }

  private getDevMonitoringGroups(): MonitoringGroup[] {
    const groupIds = this.configService.getMonitoringGroupIds();
    return groupIds.map(groupId => ({
      id: groupId,
      chain: this.configService.getChain(),
      monitors: [
        {
          name: MonitorType.Staking,
          settings: {
            handlers: [H.ActiveSetPresence],
          } as MonitorTypeSettings[MonitorType.Staking],
        },
      ],
      accounts: [
        {
          ss58: '12BX8c7oEYo67PpGG7SHX9WrXp4vfAcEbM7qYJXeKTGaBNNQ',
          hex: '0x',
          name: 'Development Test Account',
          [MonitorType.Staking]: {
            handlers: [H.ActiveSetPresence],
          },
        },
      ],
      notifications: {
        messengerType: MessengerType.Matrix,
        channels: ['#dev-alerts:matrix.org'],
      },
    }));
  }

  private updateMetrics(groups: MonitoringGroup[]): void {
    const totalGroups = groups.length;
    const totalAccounts = groups.reduce((acc, group) => acc + (group.accounts?.length || 0), 0);
    const monitorTypes = new Set<string>();

    groups.forEach(group => {
      group.monitors.forEach(monitor => monitorTypes.add(monitor.name));
    });

    this.metrics.setMonitorGroupsCount(totalGroups);
    this.metrics.setMonitoredAccountsCount(totalAccounts);
    this.metrics.setMonitorsCount(monitorTypes.size);
  }
}
