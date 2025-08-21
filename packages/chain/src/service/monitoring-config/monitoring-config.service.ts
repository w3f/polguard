import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import { MonitoringGroup, MonitoringConfigClient } from '@w3f/monitoring-types';
import { ConfigService } from '../config/config.service';
import { metrics, Meter, Gauge } from '@opentelemetry/api';

@Injectable()
export class MonitoringConfigService implements MonitoringConfigClient {
  private readonly telemetryMeter: Meter;
  private readonly telemetryTotalGroups: Gauge;
  private readonly telemetryTotalAccounts: Gauge;
  private readonly telemetryTotalMonitors: Gauge;

  constructor(
    private readonly logger: Logger,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.telemetryMeter = metrics.getMeter('monitoring-chain');
    this.telemetryTotalGroups = this.telemetryMeter.createGauge('monitoring-chain.total-groups', {
      description: 'The number of groups the service is monitoring.',
    });
    this.telemetryTotalAccounts = this.telemetryMeter.createGauge('monitoring-chain.total-accounts', {
      description: 'The number of accounts the service is monitoring.',
    });
    this.telemetryTotalMonitors = this.telemetryMeter.createGauge('monitoring-chain.total-monitors', {
      description: 'The number of monitors the service has active.',
    });
  }

  async getMonitoringGroups(): Promise<MonitoringGroup[]> {
    const monitoringApi = this.configService.getMonitoringApi();
    const configUrl = `${monitoringApi.baseUrl}${monitoringApi.endpoints.getConfig}`;

    let response;

    try {
      response = await lastValueFrom(
        this.httpService.get(configUrl, {
          params: {
            chain: this.configService.getChain(),
          },
        }),
      );
    } catch (error) {
      this.logger.error(`Failed to fetch monitoring groups from api service: ${error.message}`);
      throw new Error(`Failed to fetch monitoring groups: ${error.message}`);
    }

    const groups = response.data.groups as MonitoringGroup[]; // todo add validation

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

  private updateMetrics(groups: MonitoringGroup[]): void {
    const totalGroups = groups.length;
    const totalAccounts = groups.reduce((acc, group) => acc + (group.accounts?.length || 0), 0);
    const monitorTypes = new Set<string>();

    groups.forEach(group => {
      group.monitors.forEach(monitor => monitorTypes.add(monitor.name));
    });

    this.telemetryTotalGroups.record(totalGroups);
    this.telemetryTotalAccounts.record(totalAccounts);
    this.telemetryTotalMonitors.record(monitorTypes.size);
  }
}
