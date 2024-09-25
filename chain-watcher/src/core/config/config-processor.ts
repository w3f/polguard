import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { Chain } from '../constants';
import { MonitoringGroup, AccountId, MonitorConfig, AccountSettings } from '../interfaces';
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
    return rawConfigs.flatMap(config => 
      config.groups.map(group => this.applyDefaultsToGroup(group, config.defaults))
    );
  }

  private static applyDefaultsToGroup(group: RawMonitoringGroup, defaults: RawConfig['defaults']): RawMonitoringGroup {
    return {
      ...group,
      chains: group.chains || defaults.chains,
      monitors: group.monitors || defaults.monitors,
      alerts: group.alerts || defaults.alerts
    };
  }

  private static transformGroups(groups: RawMonitoringGroup[]): MonitoringGroup[] {
    return groups.flatMap(group => 
      group.chains.map(chain => this.transformGroup(group, chain))
    );
  }

  private static transformGroup(group: RawMonitoringGroup, chain: Chain): MonitoringGroup {
    return {
      name: group.name,
      chain,
      monitors: this.transformMonitors(group.monitors),
      accounts: group.accounts.map(account => this.transformAccount(account, chain)),
      alerts: group.alerts
    };
  }

  private static transformMonitors(monitors: RawMonitoringGroup['monitors']): MonitorConfig[] {
    return monitors.map(monitor => ({
      name: monitor.name,
      settings: monitor.settings
    }));
  }

  private static transformAccount(account: RawMonitoringGroup['accounts'][number], chain: Chain): AccountSettings {
    const accountId = this.transformAddress(account.address, account.name, chain);
    const { address, name, ...monitorSettings } = account;

    return {
      ...accountId,
      ...monitorSettings
    };
  }

  private static transformAddress(address: string, name: string | undefined, chain: Chain): AccountId {
    const hex = this.addressToHex(address);
    const ss58 = this.hexToSs58(hex, chain);
    return { 
      name: name || ss58,
      hex, 
      ss58
    };
  }

  private static addressToHex(address: string): string {
    if (isHex(address)) {
      return address;
    }
    try {
      return u8aToHex(decodeAddress(address));
    } catch (error) {
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
