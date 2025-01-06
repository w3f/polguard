import { AccountSettingsBuilder } from '../src/account-settings-builder';
import { 
  MonitorType, 
  ComparisonType, 
  MonitorConfig, 
  StakingSettings,
  BalancesSettings 
} from '@w3f/monitoring-types';

describe('AccountSettingsBuilder', () => {
  it('should merge monitor configs with account settings and apply defaults', () => {
    const monitorConfigs: MonitorConfig[] = [
      {
        name: MonitorType.Staking,
        settings: { 
          commission: 10,
          selfStake: BigInt(1000),
          commissionComparison: ComparisonType.LessThanOrEqual,
          selfStakeComparison: ComparisonType.GreaterThanOrEqual,
        } as StakingSettings,
      },
      { 
        name: MonitorType.Balances,
        settings: { 
          threshold: BigInt(1000000),
          changeComparison: ComparisonType.LessThanOrEqual,
        } as BalancesSettings 
      },
    ];
    const accountSettings = {
      payee: '14E5nqKAp3oAJcmzgZhUD2RcptBeUBScxKHgJKU4HPNcKVf3',
    };

    const result = AccountSettingsBuilder.buildSettings(monitorConfigs, accountSettings);

    expect(result).toEqual({
      [MonitorType.Staking]: {
        commission: 10,
        selfStake: BigInt(1000),
        commissionComparison: ComparisonType.LessThanOrEqual,
        selfStakeComparison: ComparisonType.GreaterThanOrEqual,
        payee: '14E5nqKAp3oAJcmzgZhUD2RcptBeUBScxKHgJKU4HPNcKVf3',
      },
      [MonitorType.Balances]: {
        threshold: BigInt(1000000),
        changeComparison: ComparisonType.LessThanOrEqual,
        payee: '14E5nqKAp3oAJcmzgZhUD2RcptBeUBScxKHgJKU4HPNcKVf3',
      },
      [MonitorType.Governance]: {},
      [MonitorType.Identity]: {},
    });
  });

  it('should allow overriding default comparison types', () => {
    const monitorConfigs: MonitorConfig[] = [
      {
        name: MonitorType.Staking,
        settings: { 
          commission: 10,
          selfStake: BigInt(1000),
          commissionComparison: ComparisonType.Equal,
          selfStakeComparison: ComparisonType.Equal,
        } as StakingSettings,
      },
    ];
    const accountSettings = {};

    const result = AccountSettingsBuilder.buildSettings(monitorConfigs, accountSettings);

    expect(result[MonitorType.Staking]).toEqual({
      commission: 10,
      selfStake: BigInt(1000),
      commissionComparison: ComparisonType.Equal,
      selfStakeComparison: ComparisonType.Equal,
    });
  });

  it('should handle empty monitor configs and account settings', () => {
    const result = AccountSettingsBuilder.buildSettings([], {});

    const expectedResult = Object.values(MonitorType).reduce((acc, monitorType) => {
      acc[monitorType] = monitorType === MonitorType.Staking 
        ? {
            commissionComparison: ComparisonType.LessThanOrEqual,
            selfStakeComparison: ComparisonType.GreaterThanOrEqual,
          }
        : {};
      return acc;
    }, {});

    expect(result).toEqual(expectedResult);
  });

  it('should apply account settings over monitor configs', () => {
    const monitorConfigs: MonitorConfig[] = [
      {
        name: MonitorType.Staking,
        settings: { 
          commission: 10,
          selfStake: BigInt(1000),
          commissionComparison: ComparisonType.LessThanOrEqual,
          selfStakeComparison: ComparisonType.GreaterThanOrEqual,
        } as StakingSettings,
      },
    ];
    const accountSettings = {
      commission: 5,
      selfStake: BigInt(2000),
    };

    const result = AccountSettingsBuilder.buildSettings(monitorConfigs, accountSettings);

    expect(result[MonitorType.Staking]).toEqual({
      commission: 5,
      selfStake: BigInt(2000),
      commissionComparison: ComparisonType.LessThanOrEqual,
      selfStakeComparison: ComparisonType.GreaterThanOrEqual,
    });
  });
});