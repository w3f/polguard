import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as path from 'path';
import { ConfigFetcher } from '@w3f/monitoring-config';
import { Chain, MonitoringGroup } from '@w3f/monitoring-types';
import { ConfigService } from '../config/config.service';

@Injectable()
export class MonitoringConfigService implements OnModuleInit {
  private readonly logger = new Logger(MonitoringConfigService.name);
  private readonly configsDir = path.join(process.cwd(), 'monitoring-configs');
  private monitoringGroups: MonitoringGroup[] = [];
  private monitoringConfigMap: Record<string, Record<string, MonitoringGroup>> = {};
  private accountsMap: Record<string, Record<string, string[]>> = {};

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    await this.refreshConfigurations();
  }

  async refreshConfigurations(): Promise<void> {
    try {
      const sources = this.configService.getMonitoringConfigSources();
      this.monitoringGroups = await ConfigFetcher.fetchAndProcessConfigs(sources, this.configsDir);

      // Check if any monitoring groups were loaded
      if (this.monitoringGroups.length === 0) {
        throw new Error(
          'No monitoring groups were loaded. Please check your configuration sources ' +
            'or add valid YAML files to the monitoring-configs directory.',
        );
      }

      // Build lookup dictionaries with uniqueness check
      this.buildLookupDictionaries();

      this.logger.log(`Loaded ${this.monitoringGroups.length} monitoring groups`);
    } catch (error) {
      this.logger.error('Failed to refresh monitoring configurations:', error);
      throw error; // Re-throw to prevent service from starting with invalid config
    }
  }

  private buildLookupDictionaries(): void {
    this.monitoringConfigMap = {};
    this.accountsMap = {};

    // Group by chain first
    for (const group of this.monitoringGroups) {
      if (!this.monitoringConfigMap[group.chain]) {
        this.monitoringConfigMap[group.chain] = {};
        this.accountsMap[group.chain] = {};
      }

      // Check for duplicate group names within the same chain
      if (this.monitoringConfigMap[group.chain][group.name]) {
        throw new Error(
          `Duplicate monitoring group name "${group.name}" found for chain "${group.chain}". ` +
            'Each monitoring group must have a unique name within a chain.',
        );
      }

      // Store the group and accounts by chain and group name
      this.monitoringConfigMap[group.chain][group.name] = group;
      this.accountsMap[group.chain][group.name] = group.accounts.map(account => account.ss58);
    }
  }

  getMonitoringGroups(chain: Chain, groupIds: string[]): MonitoringGroup[] {
    if (!this.monitoringConfigMap[chain]) {
      return [];
    }

    return groupIds
      .map(id => {
        const group = this.monitoringConfigMap[chain][id];
        if (!group) {
          this.logger.warn(`Monitoring group with ID "${id}" not found for chain "${chain}"`);
        }
        return group;
      })
      .filter(Boolean);
  }

  getAccounts(chain: Chain, groupIds: string[]): Record<string, string[]> {
    if (!this.accountsMap[chain]) {
      return {};
    }

    return groupIds.reduce(
      (result, id) => {
        if (this.accountsMap[chain][id]) {
          result[id] = this.accountsMap[chain][id];
        } else {
          this.logger.warn(`Accounts for monitoring group with ID "${id}" not found for chain "${chain}"`);
        }
        return result;
      },
      {} as Record<string, string[]>,
    );
  }
}
