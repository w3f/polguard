import { MonitorTestSuite } from './monitor-test-suite';
import { StakingMonitor } from '@lib/monitors/staking/staking-monitor';
import { MonitorType, ComparisonType } from '@w3f/monitoring-types';

describe('StakingMonitor', () => {
  let suite: MonitorTestSuite;
  let monitor: StakingMonitor;
  const TEST_BLOCK = 100;
  const TEST_ADDRESS = 'test-address';

  beforeEach(() => {
    suite = new MonitorTestSuite();
    const groups = [suite.createMonitoringGroup({
      accounts: [{
        name: 'Test Validator',
        ss58: TEST_ADDRESS,
        hex: '0x1234',
        Staking: {
          commission: 10,
          commissionComparison: ComparisonType.LessThanOrEqual,
          selfStakeComparison: ComparisonType.GreaterThanOrEqual,
          payee: 'Staked',
          selfStake: BigInt(1000),
        },
      }],
    })];
    
    monitor = new StakingMonitor(
      suite.mockLogger,
      groups,
      suite.mockIncidents,
      suite.mockStateQuery,
      suite.mockChainProps,
      MonitorType.Staking
    );
  
    suite.mockStateQuery.stakingActiveEra.mockResolvedValue(100);
  });

  describe('Event Handlers', () => {
    it('should create one-time incident when validator is slashed', async () => {
      const event = suite.createTestEvent('staking', 'SlashReported', [TEST_ADDRESS]);
      await monitor.processEvent({ eventRecord: event, blockNumber: TEST_BLOCK });
      suite.expectOneTimeIncident('has been slashed', TEST_BLOCK);
    });

    it('should not create incident when non-monitored validator is slashed', async () => {
      const event = suite.createTestEvent('staking', 'SlashReported', ['non-monitored-address']);
      await monitor.processEvent({ eventRecord: event, blockNumber: TEST_BLOCK });
      expect(suite.mockIncidents.oneTimeIncident).not.toHaveBeenCalled();
    });
  });

  describe('Call Handlers', () => {
    it('should create one-time incident when payee is changed via setPayee', async () => {
      const call = suite.createTestCall('staking', 'setPayee', ['Controller']);
  
      await monitor.processCall({ 
        call, 
        origin: TEST_ADDRESS,
        blockNumber: TEST_BLOCK,
        extrinsicIndex: 0
      });
  
      suite.expectOneTimeIncident('Destination change detected', TEST_BLOCK);
    });
  
    it('should create one-time incident when payee is changed via bond', async () => {
      const call = suite.createTestCall('staking', 'bond', [
        'controller-address',
        'Controller', // payee
        BigInt(1000)
      ]);
  
      await monitor.processCall({ 
        call, 
        origin: TEST_ADDRESS,
        blockNumber: TEST_BLOCK,
        extrinsicIndex: 0
      });
  
      suite.expectOneTimeIncident('Destination change detected', TEST_BLOCK);
    });
  
    it('should not create incident when non-monitored address changes payee', async () => {
      const call = suite.createTestCall('staking', 'setPayee', ['Controller']);
  
      await monitor.processCall({ 
        call, 
        origin: 'non-monitored-address',
        blockNumber: TEST_BLOCK,
        extrinsicIndex: 0
      });
  
      expect(suite.mockIncidents.oneTimeIncident).not.toHaveBeenCalled();
    });
  });

  describe('Block Handlers', () => {
    beforeEach(() => {
      suite.mockStateQuery.stakingValidatorsComission.mockResolvedValue({
        [TEST_ADDRESS]: 10,
      });
      suite.mockStateQuery.stakingPayee.mockResolvedValue({
        [TEST_ADDRESS]: 'Staked',
      });
      suite.mockStateQuery.sessionValidators.mockResolvedValue({
        [TEST_ADDRESS]: true,
      });
      suite.mockStateQuery.stakingBonded.mockResolvedValue({
        [TEST_ADDRESS]: 'controller-address',
      });
      suite.mockStateQuery.stakingLedgerActive.mockResolvedValue({
        'controller-address': BigInt(1000),
      });
    });

    describe('Commission Check', () => {
      it('should create ongoing incident when commission more than expected', async () => {
        suite.mockStateQuery.stakingValidatorsComission.mockResolvedValue({
          [TEST_ADDRESS]: 20, // Expected 10
        });

        await monitor.processEveryBlock({ blockNumber: TEST_BLOCK });

        suite.expectOngoingIncident('Unexpected commission', TEST_BLOCK, true);
      });

      it('should not fire incident when commission below expected', async () => {
        suite.mockStateQuery.stakingValidatorsComission.mockResolvedValue({
          [TEST_ADDRESS]: 5, // Expected 10
        });
        await monitor.processEveryBlock({ blockNumber: TEST_BLOCK });

        suite.expectOngoingIncident('Unexpected commission', TEST_BLOCK, false);
      });
    });

    describe('Payee Check', () => {
      it('should create ongoing incident for incorrect payee', async () => {
        suite.mockStateQuery.stakingPayee.mockResolvedValue({
          [TEST_ADDRESS]: 'Controller', // Expected 'Staked'
        });

        await monitor.processEveryBlock({ blockNumber: TEST_BLOCK });

        suite.expectOngoingIncident('Unexpected reward destination', TEST_BLOCK, true);
      });

      it('should not fire incident for correct payee', async () => {
        await monitor.processEveryBlock({ blockNumber: TEST_BLOCK });

        suite.expectOngoingIncident('Unexpected reward destination', TEST_BLOCK, false);
      });
    });

    describe('Active Set Check', () => {
      it('should create ongoing incident when validator is not in active set', async () => {
        suite.mockStateQuery.sessionValidators.mockResolvedValue({});

        await monitor.processEveryBlock({ blockNumber: TEST_BLOCK });

        suite.expectOngoingIncident('not present in the validation active set', TEST_BLOCK, true);
      });

      it('should not fire incident when validator is in active set', async () => {
        await monitor.processEveryBlock({ blockNumber: TEST_BLOCK });

        suite.expectOngoingIncident('not present in the validation active set', TEST_BLOCK, false);
      });
    });

    describe('Self-stake Check', () => {
      it('should create ongoing incident when self-stake is below expected', async () => {
        suite.mockStateQuery.stakingLedgerActive.mockResolvedValue({
          'controller-address': BigInt(500), // Less than expected 1000
        });
    
        await monitor.processEveryBlock({ blockNumber: TEST_BLOCK });
    
        suite.expectOngoingIncident('Unexpected self-stake', TEST_BLOCK, true);
      });
    
      it('should not fire incident when active balance is more than expected', async () => {
        suite.mockStateQuery.stakingLedgerActive.mockResolvedValue({
          'controller-address': BigInt(2000), // More than expected 1000
        });
    
        await monitor.processEveryBlock({ blockNumber: TEST_BLOCK });
        
        suite.expectOngoingIncident('Unexpected self-stake', TEST_BLOCK, false);
      });
    });
  });
});