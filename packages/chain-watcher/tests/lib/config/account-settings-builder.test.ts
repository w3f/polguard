import { AccountSettingsBuilder } from '@lib/config/account-settings-builder';
import { MonitorType, ComparisonType } from '@lib/constants';

describe('AccountSettingsBuilder', () => {
  it('should merge monitor configs with account settings', () => {
    const monitorConfigs = [
      {
        name: MonitorType.Validator,
        settings: { commission: 10, commissionComparison: ComparisonType.LessThanOrEqual },
      },
      { name: MonitorType.BalanceThreshold, settings: { balanceThreshold: '1000000' } },
    ];
    const accountSettings = {
      payee: '14E5nqKAp3oAJcmzgZhUD2RcptBeUBScxKHgJKU4HPNcKVf3',
    };

    const result = AccountSettingsBuilder.buildSettings(monitorConfigs, accountSettings);

    expect(result).toEqual({
      [MonitorType.Validator]: {
        commission: 10,
        commissionComparison: ComparisonType.LessThanOrEqual,
        payee: '14E5nqKAp3oAJcmzgZhUD2RcptBeUBScxKHgJKU4HPNcKVf3',
      },
      [MonitorType.BalanceThreshold]: {
        balanceThreshold: '1000000',
        payee: '14E5nqKAp3oAJcmzgZhUD2RcptBeUBScxKHgJKU4HPNcKVf3',
      },
      [MonitorType.Governance]: {},
      [MonitorType.TransactionIngress]: {},
      [MonitorType.TransactionEgress]: {},
      [MonitorType.BalanceIncrement]: {},
      [MonitorType.BalanceDecrement]: {},
    });
  });

  it('should handle empty monitor configs and account settings', () => {
    const result = AccountSettingsBuilder.buildSettings([], {});

    const expectedResult = Object.values(MonitorType).reduce((acc, monitorType) => {
      acc[monitorType] = monitorType === MonitorType.Validator ? { commissionComparison: ComparisonType.Equal } : {};
      return acc;
    }, {});

    expect(result).toEqual(expectedResult);
  });
});
