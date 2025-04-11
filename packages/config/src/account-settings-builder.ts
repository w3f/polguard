import { MonitorType, ComparisonType, MonitorConfig, ChainProperties, MonitorTypeSettings } from '@w3f/monitoring-types';

/**
 * Builds the final account monitor settings object used in the chain watcher.
 *
 * This class is responsible for:
 * 1. Combining account-specific settings with group-level monitor configurations:
 *    - Monitor settings serve as base configuration
 *    - Account settings override monitor settings
 *    - Handler configurations from monitors are preserved
 * 2. Applying default values for missing monitor settings (e.g., comparison types for Staking).
 * 3. Converting decimal string balances to BigInt values with proper chain decimals:
 *    - Staking: selfStake field (e.g. "100.22" -> 1002200000000n)
 *    - Balances: threshold field
 * 4. Ensuring settings are properly segregated by monitor type.
 *
 * Example usage:
 *
 * const monitorConfigs = [
 *   {
 *     name: MonitorType.Staking,
 *     settings: {
 *       commission: 10,
 *       handlers: { include: ['CommissionChanged'] }
 *     }
 *   },
 *   {
 *     name: MonitorType.Balances,
 *     settings: { threshold: "100.22" }
 *   }
 * ];
 *
 * const accountSettings = {
 *   commission: 5,        // Will override monitor's commission
 *   selfStake: "1000.5", // Will be added to Staking settings
 *   matrix: "@me:matrix" // Will be ignored as Identity monitor is not configured
 * };
 *
 * const chainProps = { chainDecimals: 10, ... };
 *
 * const result = AccountSettingsBuilder.buildSettings(monitorConfigs, accountSettings, chainProps);
 *
 * // Result will contain only configured monitors with their specific settings:
 * // {
 * //   [MonitorType.Staking]: {
 * //     commission: 5,              // From account settings
 * //     selfStake: 10005000000000n, // From account settings, converted to BigInt
 * //     commissionComparison: ComparisonType.LessThanOrEqual,  // Default applied
 * //     selfStakeComparison: ComparisonType.GreaterThanOrEqual, // Default applied
 * //     handlers: {                 // Preserved from monitor config
 * //       include: ['CommissionChanged']
 * //     }
 * //   },
 * //   [MonitorType.Balances]: {
 * //     threshold: 1002200000000n,  // From monitor settings, converted to BigInt
 * //   }
 * // }
 */
export class AccountSettingsBuilder {
  private static getMonitorTypeKeys<T extends MonitorType>(
    monitorType: T
  ): (keyof MonitorTypeSettings[T])[] {
    // TODO: Consider replacing hardcoded monitor type fields with a more maintainable solution.
    const settingsType = {
      [MonitorType.Staking]: ['commission', 'commissionComparison', 'selfStakeComparison', 'selfStake', 'payee', 'handlers'],
      [MonitorType.Balances]: ['threshold', 'changeComparison', 'handlers'],
      [MonitorType.Identity]: ['matrix', 'email', 'handlers'],
      [MonitorType.Xcm]: ['handlers'],
      [MonitorType.Telemetry]: [
        'handlers',
        'cpu',
        'minMemoryGB',
        'minCores',
        'clientVersion',
        'provider',
        'sanctionedCountries',
        'sanctionedRegions'
      ],
      [MonitorType.Governance]: ['handlers']
    };
    return settingsType[monitorType] as (keyof MonitorTypeSettings[T])[];
  }

  static buildSettings(
    monitorConfigs: MonitorConfig[],
    accountSettings: Record<string, any>,
    chainProps: ChainProperties,
  ): Record<MonitorType, Record<string, any>> {
    const mergedSettings = this.mergeSettings(monitorConfigs, accountSettings);
    const settingsWithDefaults = this.applyDefaultSettings(mergedSettings);
    return this.transformDecimalBalances(settingsWithDefaults, chainProps.chainDecimals);
  }

  private static mergeSettings(
    monitorConfigs: MonitorConfig[],
    accountSettings: Record<string, any>,
  ): Record<MonitorType, Record<string, any>> {
    const mergedSettings = {} as Record<MonitorType, Record<string, any>>;

    monitorConfigs.forEach(monitor => {
      // Initialize settings object
      mergedSettings[monitor.name] = {};
      
      // Get monitor settings without the handlers
      const { handlers, ...monitorSettings } = monitor.settings || {};
      
      // Get relevant account settings
      const relevantKeys = this.getMonitorTypeKeys(monitor.name);
      
      const relevantAccountSettings = Object.entries(accountSettings)
        .filter(([key]) => relevantKeys.includes(key as any))
        .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});

      // Merge in order
      mergedSettings[monitor.name] = {
        ...monitorSettings,
        ...relevantAccountSettings,
        ...(handlers && { handlers })
      };
    });

    return mergedSettings;
  }

  private static applyDefaultSettings(
    mergedSettings: Record<MonitorType, Record<string, any>>,
  ): Record<MonitorType, Record<string, any>> {
    const settingsWithDefaults = { ...mergedSettings };

    if (settingsWithDefaults[MonitorType.Staking]) {
      settingsWithDefaults[MonitorType.Staking] = {
        commissionComparison: ComparisonType.LessThanOrEqual,
        selfStakeComparison: ComparisonType.GreaterThanOrEqual,
        ...settingsWithDefaults[MonitorType.Staking],
      };
    }

    return settingsWithDefaults;
  }

  /**
   * Transforms decimal string balances to BigInt values.
   * Currently handles:
   * - Staking monitor: selfStake field
   * - Balances monitor: threshold field
   * 
   * @param settings - Merged settings with defaults applied
   * @param decimals - Chain-specific decimal places
   * @returns Settings with decimal strings converted to BigInt
   */
  private static transformDecimalBalances(
    settings: Record<MonitorType, Record<string, any>>,
    decimals: number
  ): Record<MonitorType, Record<string, any>> {
    const transformed = { ...settings };

    if (transformed[MonitorType.Staking]) {
      const { selfStake, ...rest } = transformed[MonitorType.Staking];
      transformed[MonitorType.Staking] = {
        ...rest,
        ...(selfStake && {
          selfStake: this.atomizeBalance(selfStake, decimals)
        })
      };
    }

    if (transformed[MonitorType.Balances]) {
      const { threshold, ...rest } = transformed[MonitorType.Balances];
      transformed[MonitorType.Balances] = {
        ...rest,
        ...(threshold && {
          threshold: this.atomizeBalance(threshold, decimals)
        })
      };
    }

    return transformed;
  }

  /**
   * Converts a decimal string balance to atomized BigInt value.
   * Example: "100.22" with 10 decimals -> 1002200000000n
   * 
   * @param decimalBalance - Balance in decimal format (e.g. "100.22")
   * @throws {Error} If the input format is invalid
   * @returns BigInt representing the atomized balance
   */
  private static atomizeBalance(decimalBalance: string, decimals: number): bigint {
    if (!/^-?\d*\.?\d*$/.test(decimalBalance)) {
      throw new Error(`Invalid balance format: ${decimalBalance}`);
    }
    const isNeg = decimalBalance.startsWith('-');
    const value = isNeg ? decimalBalance.slice(1) : decimalBalance;
    const [intPart = '0', fracPart = ''] = value.split('.');
    
    const normalizedFrac = fracPart
      .slice(0, decimals)
      .padEnd(decimals, '0');
  
    const atomicValueStr = (isNeg ? '-' : '') + intPart + normalizedFrac;
    return BigInt(atomicValueStr);
  }
}
