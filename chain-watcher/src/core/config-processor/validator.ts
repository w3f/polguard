import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { Chain, MonitorType } from '../constants';
import { RawConfig, RawMonitoringGroup } from './interfaces';
import { AlertSettings } from '../interfaces';

export class ConfigValidator {
  private static supportedMonitors = Object.values(MonitorType);
  private static supportedChains = Object.values(Chain);

  static validate(filePath: string): RawConfig {
    try {
      const fileContents = fs.readFileSync(filePath, 'utf8');
      const config = yaml.load(fileContents) as RawConfig;

      this.validateStructure(config);
      this.validateDefaults(config.defaults);
      this.validateGroups(config.groups);

      return config;
    } catch (error) {
      throw new Error(`Validation error in ${filePath}: ${error.message}`);
    }
  }

  private static validateStructure(config: RawConfig): void {
    const requiredKeys = ['version', 'defaults', 'groups'];
    for (const key of requiredKeys) {
      if (!(key in config)) {
        throw new Error(`Missing required key: ${key}`);
      }
    }

    if (typeof config.version !== 'string') {
      throw new Error('Version must be a string');
    }

    if (!Array.isArray(config.groups)) {
      throw new Error('Groups must be an array');
    }
  }

  private static validateDefaults(defaults: RawConfig['defaults']): void {
    if (!defaults.alerts) {
      throw new Error('Default alerts are required');
    }
    this.validateAlerts(defaults.alerts);
  }

  private static validateGroups(groups: RawMonitoringGroup[]): void {
    if (groups.length === 0) {
      throw new Error('At least one group is required');
    }

    groups.forEach((group, index) => {
      this.validateGroup(group, index);
    });
  }

  private static validateGroup(group: RawMonitoringGroup, index: number): void {
    if (!group.name) {
      throw new Error(`Group at index ${index} is missing a name`);
    }

    if (!Array.isArray(group.chains) || group.chains.length === 0) {
      throw new Error(`Group "${group.name}" must have at least one chain`);
    }

    group.chains.forEach(chain => {
      if (!this.supportedChains.includes(chain)) {
        throw new Error(`Group "${group.name}" contains unsupported chain: ${chain}`);
      }
    });

    if (!Array.isArray(group.monitors) || group.monitors.length === 0) {
      throw new Error(`Group "${group.name}" must have at least one monitor`);
    }

    group.monitors.forEach(monitor => {
      if (!this.supportedMonitors.includes(monitor.name)) {
        throw new Error(`Group "${group.name}" contains unsupported monitor: ${monitor.name}`);
      }
    });

    if (!Array.isArray(group.accounts) || group.accounts.length === 0) {
      throw new Error(`Group "${group.name}" must have at least one account`);
    }

    group.accounts.forEach(account => {
      if (!account.name || !account.address) {
        throw new Error(`Group "${group.name}" contains an invalid account`);
      }
      this.validateAddress(account.address, group.name);
    });

    if (group.alerts) {
      this.validateAlerts(group.alerts);
    }
  }

  private static validateAlerts(alerts: AlertSettings): void {
    if (!alerts.matrix) {
      throw new Error('Matrix alerts are required');
    }

    if (!Array.isArray(alerts.matrix.rooms) || alerts.matrix.rooms.length === 0) {
      throw new Error('At least one Matrix room is required');
    }

    alerts.matrix.rooms.forEach(room => {
      if (!/^![A-Za-z0-9\._\-]+:[A-Za-z0-9\.\-]+$/.test(room)) {
        throw new Error(`Invalid Matrix room ID: ${room}`);
      }
    });

    if (alerts.matrix.escalation) {
      if (typeof alerts.matrix.escalation.timeout !== 'number') {
        throw new Error('Escalation timeout must be a number');
      }

      if (!Array.isArray(alerts.matrix.escalation.rooms) || 
      alerts.matrix.escalation.rooms.length === 0) {
        throw new Error('At least one escalation Matrix room is required');
      }

      alerts.matrix.escalation.rooms.forEach(room => {
        if (!/^![A-Za-z0-9\._\-]+:[A-Za-z0-9\.\-]+$/.test(room)) {
          throw new Error(`Invalid Matrix escalation room ID: ${room}`);
        }
      });
    }
  }

  private static validateAddress(address: string, groupName: string): void {
    const publicKeyHexRegex = /^0x[a-fA-F0-9]{64}$/;
    const accountWalletRegex = /^[1-9A-HJ-NP-Za-km-z]{47,48}$/;
    if (!publicKeyHexRegex.test(address) && !accountWalletRegex.test(address)) {
      throw new Error(`Group "${groupName}" contains invalid account address: ${address}`);
    }
  }
}
