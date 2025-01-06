import { ConfigProcessor } from '../src/config-processor';
import { Chain, MonitorType, ComparisonType, MessengerType } from '@w3f/monitoring-types';
import * as fs from 'fs';
import * as yaml from 'js-yaml';

jest.mock('fs');

describe('ConfigProcessor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createMockConfig = groupConfig => {
    const mockConfig = { groups: [groupConfig] };
    const mockFileContents = yaml.dump(mockConfig);
    (fs.readFileSync as jest.Mock).mockReturnValue(mockFileContents);
    return ConfigProcessor.processConfigs(['mock-config.yaml']);
  };

  it('should process a valid config with a validator monitor and payee', () => {
    const result = createMockConfig({
      name: 'Test Group',
      chains: [Chain.Polkadot],
      monitors: [
        {
          name: MonitorType.Staking,
          commission: 10,
          commissionComparison: ComparisonType.LessThanOrEqual,
          selfStakeComparison: ComparisonType.GreaterThanOrEqual,
        },
      ],
      alerts: {
        messengerType: MessengerType.Matrix,
        targets: ['!example:example.com']
      },
      accounts: [
        {
          address: '15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5',
          name: 'Alice',
          payee: '14E5nqKAp3oAJcmzgZhUD2RcptBeUBScxKHgJKU4HPNcKVf3',
        },
      ],
    });

    expect(result).toHaveLength(1);
    const [group] = result;
    expect(group.name).toBe('Test Group');
    expect(group.chain).toBe(Chain.Polkadot);
    expect(group.accounts).toHaveLength(1);

    const [account] = group.accounts;
    expect(account.name).toBe('Alice');
    expect(account.ss58).toBe('15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5');
    expect(account.hex).toBe('0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d');

    expect(account[MonitorType.Staking]).toEqual({
      commission: 10,
      commissionComparison: ComparisonType.LessThanOrEqual,
      selfStakeComparison: ComparisonType.GreaterThanOrEqual,
      payee: '14E5nqKAp3oAJcmzgZhUD2RcptBeUBScxKHgJKU4HPNcKVf3',
    });

    Object.values(MonitorType).forEach(monitorType => {
      if (monitorType !== MonitorType.Staking) {
        expect(account[monitorType]).toEqual({});
      }
    });

    expect(group.alerts).toEqual({ messengerType: MessengerType.Matrix, targets: ['!example:example.com']});
  });

  it('should process a config with multiple monitor types', () => {
    const result = createMockConfig({
      name: 'Multi-Monitor Group',
      chains: [Chain.Polkadot],
      monitors: [
        { 
          name: MonitorType.Staking, 
          commission: 5,
          commissionComparison: ComparisonType.LessThanOrEqual,
          selfStakeComparison: ComparisonType.GreaterThanOrEqual,
        },
        { name: MonitorType.Governance },
        { 
          name: MonitorType.Balances, 
          threshold: '2000000',
          changeComparison: ComparisonType.LessThanOrEqual,
        },
      ],
      alerts: {
        messengerType: MessengerType.Matrix,
        targets: ['!example:example.com']
      },
      accounts: [{ address: '15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5' }],
    });

    expect(result).toHaveLength(1);
    const [{ accounts }] = result;
    const [account] = accounts;
    expect(account[MonitorType.Staking]).toEqual({
      commission: 5,
      commissionComparison: ComparisonType.LessThanOrEqual,
      selfStakeComparison: ComparisonType.GreaterThanOrEqual,
    });
    expect(account[MonitorType.Governance]).toEqual({});
    expect(account[MonitorType.Balances]).toEqual({ 
      threshold: '2000000',
      changeComparison: ComparisonType.LessThanOrEqual,
    });
  });

  it('should throw an error for invalid config', () => {
    const mockConfig = {
      groups: [
        {
          name: 'Invalid Group',
          chains: ['InvalidChain'],
          monitors: [{ name: 'InvalidMonitor' }],
          accounts: [{ address: 'invalid-address' }],
        },
      ],
    };

    const mockFileContents = yaml.dump(mockConfig);
    (fs.readFileSync as jest.Mock).mockReturnValue(mockFileContents);

    expect(() => ConfigProcessor.processConfigs(['mock-config.yaml'])).toThrow();
  });
});