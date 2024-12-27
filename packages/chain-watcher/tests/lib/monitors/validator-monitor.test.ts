import { MonitorTestSuite } from './monitor-test-suite';
import { ValidatorMonitor } from '@lib/monitors/validator/validator-monitor';
import { MonitorType, ComparisonType } from '@w3f/monitoring-types';

describe('ValidatorMonitor', () => {
  let suite: MonitorTestSuite;
  let monitor: ValidatorMonitor;
  const TEST_BLOCK = 100;
  const TEST_ADDRESS = 'test-address';

  beforeEach(() => {
    suite = new MonitorTestSuite();
    const groups = [suite.createMonitoringGroup({
      accounts: [{
        name: 'Test Validator',
        ss58: TEST_ADDRESS,
        hex: '0x1234',
        Validator: {
          commission: 10,
          commissionComparison: ComparisonType.Equal,
          payee: 'Staked',
          // No handlers config means all handlers are enabled
        },
      }],
    })];
    
    monitor = new ValidatorMonitor(
      suite.mockLogger,
      groups,
      suite.mockIncidents,
      suite.mockStateQuery,
      suite.mockChainProps,
      MonitorType.Validator
    );
  
    suite.mockStateQuery.era.mockResolvedValue(100);
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

  describe('Block Handlers', () => {
    beforeEach(() => {
      // Mock default state responses
      suite.mockStateQuery.validatorCommissions.mockResolvedValue({});
      suite.mockStateQuery.payees.mockResolvedValue({});
      suite.mockStateQuery.validators.mockResolvedValue({});
    });

    describe('Commission Check', () => {
      it('should create ongoing incident when commission differs from expected', async () => {
        suite.mockStateQuery.validatorCommissions.mockResolvedValue({
          [TEST_ADDRESS]: 20, // Different from expected 10
        });

        await monitor.processEveryBlock({ blockNumber: TEST_BLOCK });

        suite.expectOngoingIncident('Unexpected commission', TEST_BLOCK, true);
      });

      it('should not fire incident when commission matches expected', async () => {
        suite.mockStateQuery.validatorCommissions.mockResolvedValue({
          [TEST_ADDRESS]: 10, // Matches expected
        });

        await monitor.processEveryBlock({ blockNumber: TEST_BLOCK });

        suite.expectOngoingIncident('Unexpected commission', TEST_BLOCK, false);
      });
    });

    describe('Payee Check', () => {
      it('should create ongoing incident for incorrect payee', async () => {
        suite.mockStateQuery.payees.mockResolvedValue({
          [TEST_ADDRESS]: suite.createRewardDestination('Controller'),
        });
        // Mock other state queries to return valid values
        suite.mockStateQuery.validatorCommissions.mockResolvedValue({
          [TEST_ADDRESS]: 10,
        });

        await monitor.processEveryBlock({ blockNumber: TEST_BLOCK });

        suite.expectOngoingIncident('Unexpected reward destination', TEST_BLOCK, true);
      });

      it('should not fire incident for correct payee', async () => {
        suite.mockStateQuery.payees.mockResolvedValue({
          [TEST_ADDRESS]: suite.createRewardDestination('Staked'),
        });
        // Mock other state queries to return valid values
        suite.mockStateQuery.validatorCommissions.mockResolvedValue({
          [TEST_ADDRESS]: 10,
        });

        await monitor.processEveryBlock({ blockNumber: TEST_BLOCK });

        suite.expectOngoingIncident('Unexpected reward destination', TEST_BLOCK, false);
      });
    });

    describe('Active Set Check', () => {
      it('should create ongoing incident when validator is not in active set', async () => {
        suite.mockStateQuery.validators.mockResolvedValue({});
        // Mock other state queries to return valid values
        suite.mockStateQuery.validatorCommissions.mockResolvedValue({
          [TEST_ADDRESS]: 10,
        });
        suite.mockStateQuery.payees.mockResolvedValue({
          [TEST_ADDRESS]: suite.createRewardDestination('Staked'),
        });

        await monitor.processEveryBlock({ blockNumber: TEST_BLOCK });

        suite.expectOngoingIncident('not present in the validation active set', TEST_BLOCK, true);
      });

      it('should not fire incident when validator is in active set', async () => {
        suite.mockStateQuery.validators.mockResolvedValue({
          [TEST_ADDRESS]: true,
        });
        // Mock other state queries to return valid values
        suite.mockStateQuery.validatorCommissions.mockResolvedValue({
          [TEST_ADDRESS]: 10,
        });
        suite.mockStateQuery.payees.mockResolvedValue({
          [TEST_ADDRESS]: suite.createRewardDestination('Staked'),
        });

        await monitor.processEveryBlock({ blockNumber: TEST_BLOCK });

        suite.expectOngoingIncident('not present in the validation active set', TEST_BLOCK, false);
      });
    });
  });
});