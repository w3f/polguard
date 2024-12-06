/**
 * Config Processor Module
 * 
 * This module is responsible for processing and transforming the raw,
 * validated configuration data into a format that can be used by the
 * monitoring system.
 * 
 * Key responsibilities:
 * 1. Loading and parsing configuration files
 * 2. Applying defaults and merging settings from different levels (global, group, account)
 * 3. Transforming addresses into the required formats
 * 4. Structuring the configuration data into the final format expected by the system
 * 
 * Unlike the config validator, this processor DOES modify and transform the configuration data.
 * It applies defaults, merges settings, and restructures the data as needed.
 */

import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { Chain, ComparisonType, MonitorType } from '../constants';
import { MonitoringGroup, AccountId, MonitorConfig, ConfigAccountSettings } from '../interfaces';
import { RawConfig, RawMonitoringGroup } from './interfaces';
import { u8aToHex, hexToU8a, isHex } from '@polkadot/util';
import { decodeAddress, encodeAddress } from '@polkadot/util-crypto';
import { validateConfig } from './config-validator';

export class MonitoringConfigProcessor {
  private static chainPrefixMap = new Map<Chain, number>([
    [Chain.Polkadot, 0],
    [Chain.Kusama, 2],
  ]);

  public static processConfigs(configFiles: string[]): MonitoringGroup[] {
    const rawConfigs = this.loadAndValidateConfigs(configFiles);
    const extractedGroups = this.extractGroupsApplyDefaults(rawConfigs);
    return this.transformGroups(extractedGroups);
  }

  private static loadAndValidateConfigs(configFiles: string[]): RawConfig[] {
    return configFiles.map(this.loadAndValidateConfig);
  }

  private static loadAndValidateConfig(filePath: string): RawConfig {
    try {
      const fileContents = fs.readFileSync(filePath, 'utf8');
      const config = yaml.load(fileContents) as RawConfig;
      validateConfig(config);
      return config;
    } catch (error) {
      throw new Error(`Error in ${filePath}: ${error.message}`);
    }
  }

  private static extractGroupsApplyDefaults(rawConfigs: RawConfig[]): RawMonitoringGroup[] {
    return rawConfigs.flatMap(config => config.groups.map(group => this.applyDefaultsToGroup(group, config.defaults)));
  }

  private static applyDefaultsToGroup(group: RawMonitoringGroup, defaults: RawConfig['defaults']): RawMonitoringGroup {
    return {
      ...group,
      chains: group.chains || defaults?.chains,
      monitors: group.monitors || defaults?.monitors,
      alerts: group.alerts || defaults?.alerts,
    };
  }

  private static transformGroups(groups: RawMonitoringGroup[]): MonitoringGroup[] {
    return groups.flatMap(group => (group.chains || []).map(chain => this.transformGroup(group, chain)));
  }

  private static transformGroup(group: RawMonitoringGroup, chain: Chain): MonitoringGroup {
    const transformedMonitors = this.transformMonitors(group.monitors || []);
    return {
      name: group.name,
      chain,
      monitors: transformedMonitors,
      accounts: group.accounts.map(account => this.transformAccount(account, chain, transformedMonitors)),
      alerts: group.alerts,
    };
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

  /**
   * Transforms a raw account configuration into a ConfigAccountSettings object.
   * This process includes merging monitor settings, applying account-specific overrides,
   * and setting default values for certain monitor types.
   */
  private static transformAccount(
    account: RawMonitoringGroup['accounts'][number],
    chain: Chain,
    monitors: MonitorConfig[],
  ): ConfigAccountSettings {
    const accountId = this.transformAddress(account.address, account.name, chain);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { address, name, ...accountSettings } = account;

    const mergedSettings = this.mergeMonitorSettings(monitors, accountSettings);
    const settingsWithDefaults = this.applyDefaultSettings(mergedSettings);

    return { ...accountId, ...settingsWithDefaults };
  }

  /**
   * Merges monitor settings with account-specific settings.
   * Account settings are prioritized over monitor settings.
   * Initializes settings for all MonitorTypes, even if not present in the input.
   */
  private static mergeMonitorSettings(
    monitors: MonitorConfig[],
    accountSettings: Record<string, any>
  ): Record<MonitorType, Record<string, any>> {
    const mergedSettings = Object.values(MonitorType).reduce((acc, monitorType) => {
      acc[monitorType] = {};
      return acc;
    }, {} as Record<MonitorType, Record<string, any>>);

    // Apply monitor settings
    monitors.forEach(monitor => {
      if (monitor.settings) {
        mergedSettings[monitor.name] = { ...monitor.settings };
      }
    });

    // Override with account-specific settings
    Object.entries(accountSettings).forEach(([key, value]) => {
      for (const monitorType of Object.values(MonitorType)) {
        if (key in mergedSettings[monitorType]) {
          mergedSettings[monitorType][key] = value;
          break;
        }
      }
    });

    return mergedSettings;
  }

  /**
   * Applies default settings to merged monitor settings.
   * This is where monitor-specific defaults are set if they're not already defined.
   */
  private static applyDefaultSettings(
    mergedSettings: Record<MonitorType, Record<string, any>>
  ): Record<MonitorType, Record<string, any>> {
    const settingsWithDefaults = { ...mergedSettings };

    if (settingsWithDefaults[MonitorType.Validator]) {
      settingsWithDefaults[MonitorType.Validator] = {
        commissionComparison: ComparisonType.Equal,
        ...settingsWithDefaults[MonitorType.Validator],
      };
    }

    return settingsWithDefaults;
  }

  private static transformAddress(address: string, name: string | undefined, chain: Chain): AccountId {
    const hex = this.addressToHex(address);
    const ss58 = this.hexToSs58(hex, chain);
    return {
      name: name || `${ss58.slice(0, 4)}...${ss58.slice(-4)}`,
      hex,
      ss58,
    };
  }

  private static addressToHex(address: string): string {
    if (isHex(address)) {
      return address;
    }
    try {
      return u8aToHex(decodeAddress(address));
    } catch {
      throw new Error(`Invalid address format: ${address}`);
    }
  }

  private static hexToSs58(hex: string, chain: Chain): string {
    const chainPrefix = this.getChainPrefix(chain);
    return encodeAddress(hexToU8a(hex), chainPrefix);
  }

  private static getChainPrefix(chain: Chain): number {
    const prefix = this.chainPrefixMap.get(chain);
    if (prefix === undefined) {
      throw new Error(`Unsupported chain for SS58 prefix: ${chain}`);
    }
    return prefix;
  }
}
