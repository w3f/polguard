import { MonitorType, ComparisonType, MonitorConfig } from '@w3f/monitoring-types';

/**
 * Builds the final account monitor settings object used in the chain watcher.
 *
 * This class is responsible for:
 * 1. Combining account-specific settings with group-level monitor configurations.
 * 2. Applying default values for missing monitor settings.
 * 3. Constructing a final account settings object which includes each monitor type.
 *
 * Example usage:
 *
 * const monitorConfigs = [
 *   { name: MonitorType.Staking, settings: { commission: 10 } },
 *   { name: MonitorType.Governance, settings: {} }
 * ];
 *
 * const accountSettings = {
 *   commission: 5,
 *   selfStake: 1000n,
 *   payee: "Staked"
 * };
 *
 * const result = AccountMonitorSettingsBuilder.buildSettings(monitorConfigs, accountSettings);
 *
 * // Result will contain:
 * // {
 * //   [MonitorType.Staking]: {
 * //     commission: 5,
 * //     selfStake: 1000n,
 * //     payee: "Staked",
 * //     commissionComparison: ComparisonType.LessThanOrEqual,  // Default applied
 * //     selfStakeComparison: ComparisonType.GreaterThanOrEqual // Default applied
 * //   },
 * //   [MonitorType.Governance]: {
 * //     commission: 5,
 * //     selfStake: 1000n,
 * //     payee: "Staked"
 * //   }
 * // }
 */
export class AccountSettingsBuilder {
  static buildSettings(
    monitorConfigs: MonitorConfig[],
    accountSettings: Record<string, any>,
  ): Record<MonitorType, Record<string, any>> {
    const mergedSettings = this.mergeSettings(monitorConfigs, accountSettings);
    return this.applyDefaultSettings(mergedSettings);
  }

  private static mergeSettings(
    monitorConfigs: MonitorConfig[],
    accountSettings: Record<string, any>,
  ): Record<MonitorType, Record<string, any>> {
    // Initialize merged settings with empty objects for each MonitorType
    const mergedSettings = Object.values(MonitorType).reduce(
      (acc, monitorType) => ({ ...acc, [monitorType]: {} }),
      {} as Record<MonitorType, Record<string, any>>,
    );

    // Apply monitor configurations
    monitorConfigs.forEach(monitor => {
      if (monitor.settings) {
        mergedSettings[monitor.name] = { ...monitor.settings };
      }
    });

    // Merge account settings into all configured monitor types
    const configuredMonitorTypes = monitorConfigs.map(config => config.name);
    Object.entries(accountSettings).forEach(([key, value]) => {
      configuredMonitorTypes.forEach(monitorType => {
        mergedSettings[monitorType][key] = value;
      });
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
}
