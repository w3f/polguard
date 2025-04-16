import { MonitorType, ComparisonType, ChainProperties, Chain, MonitorConfig, StakingHandlerType } from '@w3f/monitoring-types';
import { AccountSettingsBuilder } from '../src/account-settings-builder';
import { monitorSchemas, extractFieldsFromSchema, extractDefaultsFromSchema } from '../src/config-validator';

describe('AccountSettingsBuilder', () => {
  describe('buildSettings', () => {
    it('should merge monitor and account settings', () => {
      const monitorConfigs: MonitorConfig[] = [
        {
          name: MonitorType.Staking,
          settings: {
            commission: 10,
            commissionComparison: ComparisonType.LessThanOrEqual,
            selfStakeComparison: ComparisonType.GreaterThanOrEqual,
            handlers: { include: [StakingHandlerType.CommissionChanged] }
          }
        }
      ];

      const accountSettings = {
        commission: 5,
        selfStake: "1000.5"
      };

      const chainProps: ChainProperties = {
        chain: Chain.Polkadot,
        specName: 'polkadot',
        chainDecimals: 10,
        chainToken: 'DOT',
        ss58Format: 0
      };

      const result = AccountSettingsBuilder.buildSettings(monitorConfigs, accountSettings, chainProps);

      expect(result).toHaveProperty(MonitorType.Staking);
      expect(result[MonitorType.Staking]).toEqual({
        commission: 5, // From account settings
        selfStake: 10005000000000n, // Converted to BigInt
        commissionComparison: ComparisonType.LessThanOrEqual, // Default
        selfStakeComparison: ComparisonType.GreaterThanOrEqual, // Default
        handlers: {
          include: [StakingHandlerType.CommissionChanged]
        }
      });
    });

    it('should only include settings for configured monitors', () => {
      const monitorConfigs: MonitorConfig[] = [
        {
          name: MonitorType.Staking,
          settings: {
            commission: 10,
            commissionComparison: ComparisonType.LessThanOrEqual,
            selfStakeComparison: ComparisonType.GreaterThanOrEqual
          }
        }
      ];

      const accountSettings = {
        commission: 5,
        matrix: "@me:matrix.org" // Identity monitor setting, but Identity monitor not configured
      };

      const chainProps: ChainProperties = {
        chain: Chain.Polkadot,
        specName: 'polkadot',
        chainDecimals: 10,
        chainToken: 'DOT',
        ss58Format: 0
      };

      const result = AccountSettingsBuilder.buildSettings(monitorConfigs, accountSettings, chainProps);

      expect(Object.keys(result)).toEqual([MonitorType.Staking]);
      expect(result).not.toHaveProperty(MonitorType.Identity);
    });

    it('should apply default values from schemas', () => {
      // Use 'as any' to bypass TypeScript type checking for the settings
      // In the real code, the threshold comes from YAML as a string
      const monitorConfigs: MonitorConfig[] = [
        {
          name: MonitorType.Balances,
          settings: {
            threshold: "100.22",
            changeComparison: ComparisonType.GreaterThanOrEqual
          } as any
        }
      ];

      const accountSettings = {};

      const chainProps: ChainProperties = {
        chain: Chain.Polkadot,
        specName: 'polkadot',
        chainDecimals: 10,
        chainToken: 'DOT',
        ss58Format: 0
      };

      const result = AccountSettingsBuilder.buildSettings(monitorConfigs, accountSettings, chainProps);

      expect(result[MonitorType.Balances]).toHaveProperty('changeComparison', ComparisonType.GreaterThanOrEqual);
      expect(result[MonitorType.Balances]).toHaveProperty('threshold', 1002200000000n);
    });
  });

  describe('Schema Utilities', () => {
    it('extractFieldsFromSchema should return all field names from a schema', () => {
      const fields = extractFieldsFromSchema(monitorSchemas[MonitorType.Staking]);
      
      expect(fields).toContain('commission');
      expect(fields).toContain('selfStake');
      expect(fields).toContain('commissionComparison');
      expect(fields).toContain('selfStakeComparison');
      expect(fields).toContain('payee');
      expect(fields).toContain('handlers');
    });

    it('extractDefaultsFromSchema should return default values from a schema', () => {
      const defaults = extractDefaultsFromSchema(monitorSchemas[MonitorType.Staking]);
      
      expect(defaults).toHaveProperty('commissionComparison', ComparisonType.LessThanOrEqual);
      expect(defaults).toHaveProperty('selfStakeComparison', ComparisonType.GreaterThanOrEqual);
    });
  });
});
