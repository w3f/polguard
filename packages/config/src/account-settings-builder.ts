import { MonitorType, MonitorConfig, ChainProperties, MonitorTypeSettings, CHAIN_TOKENS } from '@w3f/monitoring-common';
import { monitorSchemas, extractFieldsFromSchema } from './config-validator';

/**
 * Builds the final account monitor settings object used in the chain watcher.
 *
 * This class is responsible for:
 * 1. Combining account-specific settings with group-level monitor configurations:
 *    - Monitor settings serve as base configuration
 *    - Account settings override monitor settings
 *    - Handler configurations from monitors are preserved
 * 2. Converting decimal string balances to BigInt values with proper chain decimals:
 *    - Staking: selfStake field (e.g. "100.22" -> 1002200000000n)
 *    - Balances: threshold field
 * 3. Ensuring settings are properly segregated by monitor type.
 *
 * Example usage:
 *
 * const monitorConfigs = [
 *   {
 *     name: MonitorType.Staking,
 *     settings: {
 *       commission: 10,
 *       handlers: ['CommissionChangedEvent']
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
 * //     handlers: ['CommissionChangedEvent']  // Preserved from monitor config
 * //   },
 * //   [MonitorType.Balances]: {
 * //     threshold: 1002200000000n,  // From monitor settings, converted to BigInt
 * //   }
 * // }
 */
export class AccountSettingsBuilder {
  /**
   * Gets the field names for a specific monitor type from its Joi schema.
   * This replaces the hardcoded list of fields with a dynamic approach that
   * extracts the fields from the validation schema.
   *
   * @param monitorType - The monitor type to get fields for
   * @returns An array of field names for the monitor type
   */
  private static getMonitorTypeKeys<T extends MonitorType>(monitorType: T): (keyof MonitorTypeSettings[T])[] {
    const schema = monitorSchemas[monitorType];
    if (!schema) {
      return [] as (keyof MonitorTypeSettings[T])[];
    }

    return extractFieldsFromSchema(schema) as (keyof MonitorTypeSettings[T])[];
  }

  static buildSettings(
    monitorConfigs: MonitorConfig[],
    accountSettings: Record<string, any>,
    chainProps: ChainProperties,
  ): Record<MonitorType, Record<string, any>> {
    const mergedSettings = this.mergeSettings(monitorConfigs, accountSettings);
    return this.transformDecimalBalances(mergedSettings, chainProps);
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
        ...(handlers && { handlers }),
      };
    });

    return mergedSettings;
  }

  /**
   * Transforms decimal string balances to BigInt values.
   * Currently handles:
   * - Staking monitor: selfStake field
   * - Balances monitor: threshold field
   *
   * @param settings - Merged settings
   * @param chainProps - Chain properties
   * @returns Settings with decimal strings converted to BigInt
   */
  private static transformDecimalBalances(
    settings: Record<MonitorType, Record<string, any>>,
    chainProps: ChainProperties,
  ): Record<MonitorType, Record<string, any>> {
    const transformed = { ...settings };

    if (transformed[MonitorType.Staking]) {
      const { selfStake, ...rest } = transformed[MonitorType.Staking];
      transformed[MonitorType.Staking] = {
        ...rest,
        ...(selfStake && {
          selfStake: this.atomizeBalance(selfStake, chainProps.chainDecimals),
        }),
      };
    }

    if (transformed[MonitorType.Balances]) {
      const { threshold, ...rest } = transformed[MonitorType.Balances];
      transformed[MonitorType.Balances] = {
        ...rest,
        ...(threshold && {
          threshold: this.atomizeBalance(threshold, chainProps.chainDecimals),
        }),
      };
    }

    if (transformed[MonitorType.Assets] && transformed[MonitorType.Assets].tokenThresholds) {
      const tokenThresholds = transformed[MonitorType.Assets].tokenThresholds;
      transformed[MonitorType.Assets].tokenThresholds = tokenThresholds.map(([token, threshold]: [string, string]) => [
        token,
        this.atomizeBalance(threshold, CHAIN_TOKENS[chainProps.chain][token].decimals),
      ]);
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

    const normalizedFrac = fracPart.slice(0, decimals).padEnd(decimals, '0');

    const atomicValueStr = (isNeg ? '-' : '') + intPart + normalizedFrac;
    return BigInt(atomicValueStr);
  }
}
