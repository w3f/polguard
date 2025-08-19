import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as path from 'node:path';
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
  private channelToGroupsMap: Record<string, string[]> = {};
  private allActiveAccounts: string[] = [];

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    await this.refreshConfigurations();
  }

  async refreshConfigurations(): Promise<void> {
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
  }

  private buildLookupDictionaries(): void {
    this.monitoringConfigMap = {};
    this.accountsMap = {};
    this.channelToGroupsMap = {};
    const allActiveAccountsSet = new Set<string>();

    // Group by chain first
    for (const group of this.monitoringGroups) {
      if (!this.monitoringConfigMap[group.chain]) {
        this.monitoringConfigMap[group.chain] = {};
        this.accountsMap[group.chain] = {};
      }

      // Check for duplicate group names within the same chain
      if (this.monitoringConfigMap[group.chain][group.id]) {
        throw new Error(
          `Duplicate monitoring group name "${group.id}" found for chain "${group.chain}". ` +
            'Each monitoring group must have a unique name within a chain.',
        );
      }

      // Store the group and accounts by chain and group name
      this.monitoringConfigMap[group.chain][group.id] = group;
      const accountAddresses = group.accounts.map(account => account.ss58);
      this.accountsMap[group.chain][group.id] = accountAddresses;

      accountAddresses.forEach(address => allActiveAccountsSet.add(address));

      // Build channel-to-groups mapping with concatenated key
      for (const channelId of group.notifications.channels) {
        const key = `${group.notifications.messengerType}:${channelId}:${group.chain}`;
        if (!this.channelToGroupsMap[key]) {
          this.channelToGroupsMap[key] = [];
        }
        this.channelToGroupsMap[key].push(group.id);
      }
    }

    this.allActiveAccounts = Array.from(allActiveAccountsSet);
  }

  getMonitoringGroups(chain: Chain, groupIds: string[]): MonitoringGroup[] {
    if (!this.monitoringConfigMap[chain]) {
      return [];
    }

    // If groupIds is empty (not provided), return all groups for the chain
    if (groupIds.length === 0) {
      return Object.values(this.monitoringConfigMap[chain]);
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

  getAccounts(chain: Chain, groupIds?: string[]): Record<string, string[]> {
    if (!this.accountsMap[chain]) {
      return {};
    }

    // If groupIds is empty (not provided), return all accounts for the chain
    if (!groupIds || groupIds.length === 0) {
      return this.accountsMap[chain];
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

  getAccountsByChannel(chain: Chain, messengerType: string, channelId: string): Record<string, string[]> {
    const key = `${messengerType}:${channelId}:${chain}`;
    const groupIds = this.channelToGroupsMap[key];

    // ChannelId doesn't exist
    if (!groupIds || groupIds.length === 0) {
      return {};
    }
    return this.getAccounts(chain, groupIds);
  }

  /**
   * Gets all active accounts across all chains and groups
   * @returns Array of all active account addresses
   */
  getAllActiveAccounts(): string[] {
    return this.allActiveAccounts;
  }
}
