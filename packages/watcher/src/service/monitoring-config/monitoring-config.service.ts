import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import { MonitoringGroup, MonitoringConfigClient, MetricsClient } from '@w3f/monitoring-types';
import { ConfigService } from '../config/config.service';

@Injectable()
export class MonitoringConfigService implements MonitoringConfigClient {
  constructor(
    private readonly logger: Logger,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly metrics: MetricsClient,
  ) {}

  async getMonitoringGroups(): Promise<MonitoringGroup[]> {
    try {
      // Use the dedicated config URL
      const configUrl = this.configService.getMonitoringConfigUrl();

      // Get group IDs from config
      const groupIds = this.configService.getMonitoringGroupIds();

      const response = await lastValueFrom(
        this.httpService.get(configUrl, {
          params: {
            chain: this.configService.getChain(),
            groupIds: groupIds.join(','),
          },
        }),
      );

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
    } catch (error) {
      this.logger.error(`Failed to fetch monitoring groups from IMS: ${error.message}`);
      throw new Error(`Failed to fetch monitoring groups: ${error.message}`);
    }
  }

  private logGroupDetails(groups: MonitoringGroup[]): void {
    this.logger.log(`Fetched ${groups.length} monitoring groups from IMS:`);

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

  private updateMetrics(groups: MonitoringGroup[]): void {
    // Calculate metrics
    const totalGroups = groups.length;
    const totalAccounts = groups.reduce((acc, group) => acc + (group.accounts?.length || 0), 0);
    const monitorTypes = new Set<string>();

    // Count unique monitor types
    groups.forEach(group => {
      group.monitors.forEach(monitor => monitorTypes.add(monitor.name));
    });

    // Update metrics
    this.metrics.setMonitorGroupsCount(totalGroups);
    this.metrics.setMonitoredAccountsCount(totalAccounts);
    this.metrics.setMonitorsCount(monitorTypes.size);
  }
}
