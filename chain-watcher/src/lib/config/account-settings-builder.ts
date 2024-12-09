import { MonitorType, ComparisonType } from '../constants';
import { MonitorConfig } from '../interfaces';

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
 *   { name: MonitorType.Validator, settings: { commission: 10 } },
 *   { name: MonitorType.Governance, settings: {} }
 * ];
 *
 * const accountSettings = {
 *   commission: 5,
 *   payee: "5G16fa..."
 * };
 *
 * const result = AccountMonitorSettingsBuilder.buildSettings(monitorConfigs, accountSettings);
 *
 * // Result will contain:
 * // {
 * //   [MonitorType.Validator]: {
 * //     commission: 5,
 * //     commissionComparison: ComparisonType.Equal,
 * //     payee: "5G16fa..."
 * //   },
 * //   [MonitorType.Governance]: {},
 * //   ... (other monitor types with their respective settings)
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

    if (settingsWithDefaults[MonitorType.Validator]) {
      settingsWithDefaults[MonitorType.Validator] = {
        commissionComparison: ComparisonType.Equal,
        ...settingsWithDefaults[MonitorType.Validator],
      };
    }

    return settingsWithDefaults;
  }
}
