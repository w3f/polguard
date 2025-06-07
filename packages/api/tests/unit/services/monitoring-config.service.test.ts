import { Test, TestingModule } from '@nestjs/testing';
import { MonitoringConfigService } from '../../../src/monitoring-config/monitoring-config.service';
import { ConfigService } from '../../../src/config/config.service';
import { ConfigFetcher } from '@w3f/monitoring-config';
import { 
  Chain, 
  MonitorType, 
  MessengerType, 
  MonitoringGroup, 
  ConfigAccountSettings,
  StakingHandlerType
} from '@w3f/monitoring-types';

// Mock the ConfigFetcher
jest.mock('@w3f/monitoring-config', () => ({
  ConfigFetcher: {
    fetchAndProcessConfigs: jest.fn(),
  },
}));

// Helper function to create test accounts
const createAccount = (ss58: string, name: string): ConfigAccountSettings => ({
  ss58,
  hex: `0x${ss58.substring(0, 8)}`, // Simplified hex representation
  name,
});

// Helper function to create a monitoring group
const createMonitoringGroup = (
  id: string,
  chain: Chain,
  accounts: ConfigAccountSettings[]
): MonitoringGroup => ({
  id,
  chain,
  monitors: [
    {
      name: MonitorType.Staking,
      settings: {
        commission: 10,
        handlers: [
          StakingHandlerType.CommissionChangedEvent, 
          StakingHandlerType.SlashReportedEvent, 
          StakingHandlerType.CommissionUnexpectedState
        ],
      },
    },
  ],
  accounts,
  notifications: {
    messengerType: MessengerType.Matrix,
    channels: ['!testroom:matrix.org'],
  },
});

describe('MonitoringConfigService', () => {
  let service: MonitoringConfigService;
  let configService: jest.Mocked<ConfigService>;
  
  // Test data - wallet addresses
  const alice = createAccount('15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5', 'Alice');
  const bob = createAccount('14E5nqKAp3oAJcmzgZhUD2RcptBeUBScxKHgJKU4HPNcKVf3', 'Bob');
  const charlie = createAccount('14Gjs1TD93gnwEBfDMHoCgsuf1s2TVKUP6Z1qKmAZnZ8cW5q', 'Charlie');
  const testWallet = createAccount('126TwBzBM4jUEK2gTphmW4oLoBWWnYvPp8hygmduTr4uds57', 'Test wallet');
  
  // Test data - monitoring groups
  const mockMonitoringGroups: MonitoringGroup[] = [
    createMonitoringGroup('validators-default', Chain.Polkadot, [alice, bob]),
    createMonitoringGroup('validators-custom', Chain.Polkadot, [charlie]),
    createMonitoringGroup('validators-test-group', Chain.Kusama, [testWallet]),
  ];

  beforeEach(async () => {
    // Mock ConfigService
    configService = {
      getMonitoringConfigSources: jest.fn().mockReturnValue(['test-source']),
    } as unknown as jest.Mocked<ConfigService>;

    // Mock ConfigFetcher
    (ConfigFetcher.fetchAndProcessConfigs as jest.Mock).mockResolvedValue(mockMonitoringGroups);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MonitoringConfigService,
        {
          provide: ConfigService,
          useValue: configService,
        },
      ],
    }).compile();

    service = module.get<MonitoringConfigService>(MonitoringConfigService);
    
    // Call refreshConfigurations manually since we're not testing onModuleInit
    await service.refreshConfigurations();
  });

  it('loads monitoring groups on initialization', async () => {
    expect(configService.getMonitoringConfigSources).toHaveBeenCalled();
    expect(ConfigFetcher.fetchAndProcessConfigs).toHaveBeenCalledWith(
      ['test-source'],
      expect.any(String)
    );
  });

  describe('getMonitoringGroups', () => {
    it('returns all groups for a chain when no groupIds provided', () => {
      const groups = service.getMonitoringGroups(Chain.Polkadot, []);
      expect(groups).toHaveLength(2);
      expect(groups[0].id).toBe('validators-default');
      expect(groups[1].id).toBe('validators-custom');
    });

    it('returns specific groups when groupIds provided', () => {
      const groups = service.getMonitoringGroups(Chain.Polkadot, ['validators-default']);
      expect(groups).toHaveLength(1);
      expect(groups[0].id).toBe('validators-default');
    });

    it('returns empty array for non-existent chain', () => {
      const groups = service.getMonitoringGroups('NonExistentChain' as Chain, []);
      expect(groups).toEqual([]);
    });
  });

  describe('getAccounts', () => {
    it('returns all accounts for a chain when no groupIds provided', () => {
      const accounts = service.getAccounts(Chain.Polkadot, []);
      expect(Object.keys(accounts)).toHaveLength(2);
      expect(accounts['validators-default']).toEqual([alice.ss58, bob.ss58]);
      expect(accounts['validators-custom']).toEqual([charlie.ss58]);
    });

    it('returns specific accounts when groupIds provided', () => {
      const accounts = service.getAccounts(Chain.Polkadot, ['validators-default']);
      expect(Object.keys(accounts)).toHaveLength(1);
      expect(accounts['validators-default']).toEqual([alice.ss58, bob.ss58]);
    });

    it('returns empty object for non-existent chain', () => {
      const accounts = service.getAccounts('NonExistentChain' as Chain, []);
      expect(accounts).toEqual({});
    });
  });

  describe('getAllActiveAccounts', () => {
    it('returns all active accounts across all chains', () => {
      const allAccounts = service.getAllActiveAccounts();
      expect(allAccounts).toHaveLength(4);
      expect(allAccounts).toContain(alice.ss58);
      expect(allAccounts).toContain(bob.ss58);
      expect(allAccounts).toContain(charlie.ss58);
      expect(allAccounts).toContain(testWallet.ss58);
    });
  });
});
