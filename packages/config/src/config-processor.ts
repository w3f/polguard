import * as fs from 'node:fs';
import * as yaml from 'js-yaml';
import {
  MonitoringGroup,
  MonitorConfig,
  ConfigAccountSettings,
  Chain,
  getChainProperties,
  MonitorTypeSettings,
  MonitorType,
} from '@w3f/monitoring-types';
import { RawMonitoringGroup } from './interfaces';
import { validateConfig } from './config-validator';
import { AddressTransformer } from './address-transformer';
import { AccountSettingsBuilder } from './account-settings-builder';

/**
 * Processes configuration files and transforms them into structured monitoring groups.
 *
 * This class is responsible for:
 * 1. Loading and validating YAML configuration files:
 *    - Ensures required fields are present
 *    - Validates field formats and values
 *    - Checks cross-field dependencies
 *
 * 2. Applying defaults:
 *    - Uses defaults.chains if group.chains not provided
 *    - Uses defaults.monitors if group.monitors not provided
 *    - Uses defaults.notifications if group.notifications not provided
 *
 * 3. Building final monitoring structure:
 *    - Creates separate group for each chain configuration
 *    - Transforms addresses to chain-specific SS58 format
 *    - Merges monitor-level settings and account-level settings with priority to accounts
 *    - Converts decimal balance strings to chain-specific BigInt values
 *
 * Output example:
 * [
 *   {
 *     id: "validators-group",
 *     chain: Chain.Polkadot,
 *     monitors: [
 *       {
 *         name: MonitorType.Staking,
 *         settings: { commission: 10, handlers: ["CommissionChangedEvent"] }
 *       }
 *     ],
 *     accounts: [
 *       {
 *         name: "5Grw...utQY",
 *         hex: "0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d",
 *         ss58: "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
 *         Staking: {
 *           commission: 5,
 *           selfStake: 10005000000000n
 *         }
 *       }
 *     ],
 *     notifications: {
 *       messengerType: "Matrix",
 *       channels: ["!room:matrix.org"]
 *     },
 *   }
 * ]
 */
export class ConfigProcessor {
  static processConfigs(configFiles: string[]): MonitoringGroup[] {
    const rawConfigs = this.loadAndValidateConfigs(configFiles);
    const extractedGroups = this.extractGroupsAndApplyDefaults(rawConfigs);
    return this.transformGroups(extractedGroups);
  }

  private static loadAndValidateConfigs(configFiles: string[]): any[] {
    return configFiles.map(filePath => {
      try {
        const fileContents = fs.readFileSync(filePath, 'utf8');
        const config = yaml.load(fileContents) as any;
        validateConfig(config);
        return config;
      } catch (error) {
        throw new Error(`Error in ${filePath}: ${error.message}`);
      }
    });
  }

  private static extractGroupsAndApplyDefaults(rawConfigs: any[]): RawMonitoringGroup[] {
    return rawConfigs.flatMap(config =>
      config.groups.map((group: any) => {
        return {
          ...group,
          accounts: config.accountSets[group.accountSet],
          chains: group.chains || config.defaults?.chains,
          monitors: group.monitors || config.defaults?.monitors,
          notifications: group.notifications || config.defaults?.notifications,
        };
      }),
    );
  }

  private static transformGroups(groups: RawMonitoringGroup[]): MonitoringGroup[] {
    return groups.flatMap(group => {
      const transformedMonitors = this.transformMonitors(group.monitors || []);
      return (group.chains || []).map(chain => ({
        id: group.id,
        chain,
        monitors: transformedMonitors,
        accounts: group.accounts.map(account => this.transformAccount(account, chain, transformedMonitors)),
        notifications: group.notifications,
        annotations: group.annotations,
      }));
    });
  }

  private static transformMonitors(monitors: RawMonitoringGroup['monitors']): MonitorConfig[] {
    return monitors.map(monitor => {
      const { name, ...settings } = monitor;
      return {
        name,
        settings: settings as MonitorTypeSettings[MonitorType],
      };
    });
  }

  private static transformAccount(
    account: RawMonitoringGroup['accounts'][number],
    chain: Chain,
    monitors: MonitorConfig[],
  ): ConfigAccountSettings {
    const chainProps = getChainProperties(chain);
    const accountId = AddressTransformer.transform(account.address, account.name, chainProps);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { address, name, ...accountSettings } = account;
    const mergedSettings = AccountSettingsBuilder.buildSettings(monitors, accountSettings, chainProps);
    return { ...accountId, ...mergedSettings };
  }
}
