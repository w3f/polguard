import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { Chain, MonitorType } from '../constants';
import { MonitoringGroup, AccountId, AlertSettings, MonitorSettings } from '../interfaces';
import { RawConfig, RawMonitoringGroup, RawMonitor } from './interfaces';
import { u8aToHex, hexToU8a, isHex } from '@polkadot/util';
import { decodeAddress, encodeAddress } from '@polkadot/util-crypto';
import { validateConfig } from './config-validator';

export class MonitoringConfigProcessor {

  // TODO: move chainPrefixMap to constants?
  private static chainPrefixMap = new Map<Chain, number>([
    [Chain.Polkadot, 0],
    [Chain.Kusama, 2],
  ]);

  public static processConfigs(configFiles: string[]): MonitoringGroup[] {
    const rawConfigs = configFiles.map(file => this.loadAndValidateConfig(file));
    const extractedGroups = this.extractGroupsApplyDefaults(rawConfigs);
    return this.transformGroups(extractedGroups);
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
      config.groups.map(group => ({
        ...group,
        chains: group.chains || config.defaults.chains,
        monitors: group.monitors || config.defaults.monitors,
        alerts: group.alerts || config.defaults.alerts
      }))
    );
  }

  private static transformGroups(groups: RawMonitoringGroup[]): MonitoringGroup[] {
    return groups.flatMap(group => 
      group.chains.map(chain => ({
        name: group.name,
        chain,
        monitors: this.transformMonitors(group.monitors, chain),
        accounts: group.accounts.map(
          account => this.getAccountId(account.address, account.name, this.getChainPrefix(chain))
        ),
        alerts: group.alerts
      }))
    );
  }

  private static transformMonitors(monitors: RawMonitor[], chain: Chain): MonitorSettings[] {
    return monitors.map(monitor => {
      switch (monitor.name) {
        case MonitorType.Validator:
          if (monitor.defaults?.commission === undefined) {
            throw new Error(`Commission is required for Validator monitor`);
          }
          return {
            name: monitor.name,
            defaults: {
              commission: monitor.defaults.commission,
              payee: monitor.defaults?.payee ? this.getAccountId(monitor.defaults.payee, 'Payee', this.getChainPrefix(chain)) : undefined
            }
          };
        case MonitorType.Governance:
        case MonitorType.Transaction:
          return { name: monitor.name };
        default:
          throw new Error(`Unhandled monitor type: ${monitor.name}`);
      }
    });
  }

  private static getAccountId(address: string, name: string | undefined, chainPrefix: number): AccountId {
    let hex: string;
    if (isHex(address)) {
      hex = address;
    } else {
      try {
        hex = u8aToHex(decodeAddress(address));
      } catch (error) {
        throw new Error(`Invalid address format for account ${name || address}: ${address}`);
      }
    }
    const ss58 = encodeAddress(hexToU8a(hex), chainPrefix);
    return { 
      // Use ss58 as name if name is not provided
      name: name || ss58,
      hex, 
      ss58
    };
  }

  private static getChainPrefix(chain: Chain): number {
    const prefix = this.chainPrefixMap.get(chain);
    if (prefix === undefined) {
      throw new Error(`Unsupported chain for SS58 prefix: ${chain}`);
    }
    return prefix;
  }
}
