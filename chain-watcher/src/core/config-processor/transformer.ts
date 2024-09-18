import { Chain, MonitorType } from '../constants';
import { MonitoringGroup, MonitorSettings, AccountId, AlertSettings } from '../interfaces';
import { RawMonitoringGroup } from './interfaces';
import { u8aToHex, hexToU8a, isHex } from '@polkadot/util';
import { decodeAddress, encodeAddress } from '@polkadot/util-crypto';

class TransformationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TransformationError';
  }
}

export class ConfigTransformer {
  static transformGroups(groups: RawMonitoringGroup[]): MonitoringGroup[] {
    const transformedGroups = [];
    try {
      groups.forEach(group => {
        group.chains.forEach(chainName => {
          if (!(chainName in Chain)) {
            throw new TransformationError(`Invalid chain: ${chainName}`);
          }
          const chain = Chain[chainName as keyof typeof Chain];
          transformedGroups.push({
            name: group.name,
            chain,
            monitors: this.transformMonitors(group.monitors, chain),
            accounts: group.accounts.map(
              account => this.getAccountId(account.address, account.name, this.getChainPrefix(chain))
            ),
            alerts: group.alerts
          });
        });
      });
    } catch (error) {
      throw new TransformationError(`Error transforming group: ${error.message}`);
    }
    return transformedGroups
  }

  private static transformMonitors(monitors: RawMonitoringGroup['monitors'], chain: Chain): MonitorSettings[] {
    return monitors.map(monitor => {
      if (monitor.name in MonitorType) {
        const monitorType = MonitorType[monitor.name as keyof typeof MonitorType];
        switch (monitorType) {
          case MonitorType.Validator:
            if (monitor.payee !== undefined) {
              throw new TransformationError(`Commission is required for Validator monitor`);
            }
            return {
              name: monitorType,
              defaults: {
                commission: monitor?.commission,
                payee: monitor?.payee ? this.getAccountId(monitor.payee, 'Payee', this.getChainPrefix(chain)) : undefined
              }
            };
          case MonitorType.Governance:
          case MonitorType.Transaction:
            return { name: monitorType };
          default:
            throw new TransformationError(`Unhandled monitor type: ${monitorType}`);
        }
      }
      throw new TransformationError(`Invalid monitor: ${monitor.name}`);
    });
  }

  private static getAccountId(address: string, name: string, chainPrefix: number): AccountId {
    let hex: string;
    if (isHex(address)) {
      hex = address;
    } else {
      try {
        hex = u8aToHex(decodeAddress(address));
      } catch (error) {
        throw new TransformationError(`Invalid address format for account ${name}: ${address}`);
      }
    }
    const ss58 = encodeAddress(hexToU8a(hex), chainPrefix);
    return { name: name, hex, ss58 };
  }

  private static getChainPrefix(chain: Chain): number {
    switch (chain) {
      case Chain.Polkadot:
      case Chain.PolkadotAssetHub:
        return 0;
      case Chain.Kusama:
      case Chain.KusamaAssetHub:
        return 2;
      default:
        throw new TransformationError(`Unsupported chain for SS58 prefix: ${chain}`);
    }
  }
}
