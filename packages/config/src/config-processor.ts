import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { MonitoringGroup, MonitorConfig, ConfigAccountSettings, Chain } from '@w3f/monitoring-types';
import { RawConfig, RawMonitoringGroup } from './interfaces';
import { validateConfig } from './config-validator';
import { AddressTransformer } from './address-transformer';
import { AccountSettingsBuilder } from './account-settings-builder';

/**
 * Processes configuration files and transforms them into structured monitoring groups.
 *
 * This class is responsible for:
 * 1. Loading and validating configuration files.
 * 2. Applying defaults from the default group if chains, monitors or alerts were not provided.
 * 3. Building account settings by merging monitor configs with account-specific settings.
 * 4. Producing final MonitoringGroup objects with fully processed accounts.
 *
 * Example usage:
 *
 * const configFiles = ['config1.yaml', 'config2.yaml'];
 * const monitoringGroups = ConfigProcessor.processConfigs(configFiles);
 */
export class ConfigProcessor {
  static processConfigs(configFiles: string[]): MonitoringGroup[] {
    const rawConfigs = this.loadAndValidateConfigs(configFiles);
    const extractedGroups = this.extractGroupsAndApplyDefaults(rawConfigs);
    return this.transformGroups(extractedGroups);
  }

  private static loadAndValidateConfigs(configFiles: string[]): RawConfig[] {
    return configFiles.map(filePath => {
      try {
        const fileContents = fs.readFileSync(filePath, 'utf8');
        const config = yaml.load(fileContents) as RawConfig;
        validateConfig(config);
        return config;
      } catch (error) {
        throw new Error(`Error in ${filePath}: ${error.message}`);
      }
    });
  }

  private static extractGroupsAndApplyDefaults(rawConfigs: RawConfig[]): RawMonitoringGroup[] {
    return rawConfigs.flatMap(config =>
      config.groups.map(group => ({
        ...group,
        chains: group.chains || config.defaults?.chains,
        monitors: group.monitors || config.defaults?.monitors,
        alerts: group.alerts || config.defaults?.alerts,
      })),
    );
  }

  private static transformGroups(groups: RawMonitoringGroup[]): MonitoringGroup[] {
    return groups.flatMap(group => {
      const transformedMonitors = this.transformMonitors(group.monitors || []);
      return (group.chains || []).map(chain => ({
        name: group.name,
        chain,
        monitors: transformedMonitors,
        accounts: group.accounts.map(account => this.transformAccount(account, chain, transformedMonitors)),
        alerts: group.alerts,
        // TODO: Remove or redesign, this key doesn't belong to monitoring
        enablePayout: group?.enablePayout || false,
      }));
    });
  }

  private static transformMonitors(monitors: RawMonitoringGroup['monitors']): MonitorConfig[] {
    return monitors.map(monitor => {
      const { name, ...settings } = monitor;
      return {
        name,
        settings: Object.keys(settings).length > 0 ? settings : undefined,
      };
    });
  }

  private static transformAccount(
    account: RawMonitoringGroup['accounts'][number],
    chain: Chain,
    monitors: MonitorConfig[],
  ): ConfigAccountSettings {
    const accountId = AddressTransformer.transform(account.address, account.name, chain);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { address, name, ...accountSettings } = account;

    const mergedSettings = AccountSettingsBuilder.buildSettings(monitors, accountSettings);

    return { ...accountId, ...mergedSettings };
  }
}
