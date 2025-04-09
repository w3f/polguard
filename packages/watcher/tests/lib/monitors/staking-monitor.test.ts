import { MonitorTestSuite } from './monitor-test-suite';
import { StakingMonitor } from '@lib/chain/monitors/staking/staking-monitor';
import { MonitorType, ComparisonType, StakingHandlerType as H, Chain } from '@w3f/monitoring-types';

describe('StakingMonitor', () => {
  let suite: MonitorTestSuite;
  let monitor: StakingMonitor;
  const TEST_BLOCK = 100;
  const TEST_ADDRESS = 'test-address';
  const DEFAULT_STAKING_CONFIG = {
    commission: 10,
    commissionComparison: ComparisonType.LessThanOrEqual,
    selfStakeComparison: ComparisonType.GreaterThanOrEqual,
    payee: 'Staked',
    selfStake: BigInt(1000),
  };
  const DEFAULT_STAKING_STATE = {
    commission: 10,
    selfStake: BigInt(1000),
    payee: 'Staked',
    isValidator: true,
  };

  beforeEach(() => {
    suite = new MonitorTestSuite();
    const groups = [suite.createMonitoringGroup({
      accounts: [{
        name: 'Test Validator',
        ss58: TEST_ADDRESS,
        hex: '0x1234',
        Staking: DEFAULT_STAKING_CONFIG,
      }],
      chain: Chain.Polkadot,
    })];
    
    monitor = new StakingMonitor(
      suite.mockLogger,
      groups,
      suite.mockIncidents,
      suite.mockChainProps,
      suite.mockProvider,
      MonitorType.Staking
    );

    // Setup default mock responses
    suite.mockStakingState(TEST_ADDRESS, DEFAULT_STAKING_STATE);
    suite.mockProvider.stakingActiveEra.mockResolvedValue(100);  // Updated reference
  });

  describe('Event Handlers', () => {
    describe(H.SlashReported, () => {
      it('should create one-time incident when validator is slashed', async () => {
        const event = suite.createTestEvent('staking', 'SlashReported', [TEST_ADDRESS]);
        await monitor.processEvent({ eventRecord: event, blockNumber: TEST_BLOCK });

        expect(suite.mockIncidents.oneTimeIncident).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.stringContaining('has been slashed'),
            expect.stringContaining('Block: 100'),
            expect.stringContaining('Network: Polkadot')
          ]),
          expect.any(Object),
          expect.any(Object),
          TEST_BLOCK
        );
      });

      it('should not create incident when non-monitored validator is slashed', async () => {
        const event = suite.createTestEvent('staking', 'SlashReported', ['non-monitored-address']);
        await monitor.processEvent({ eventRecord: event, blockNumber: TEST_BLOCK });
        expect(suite.mockIncidents.oneTimeIncident).not.toHaveBeenCalled();
      });
    });

    describe(H.CommissionChanged, () => {
      it('should create one-time incident when commission is changed', async () => {
        const prefs = { commission: 20, blocked: false };
        const event = suite.createTestEvent('staking', 'ValidatorPrefsSet', [TEST_ADDRESS, prefs]);
        
        await monitor.processEvent({ eventRecord: event, blockNumber: TEST_BLOCK });
        
        expect(suite.mockIncidents.oneTimeIncident).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.stringContaining('Commission change detected'),
            expect.stringContaining('Commission: 20')
          ]),
          expect.any(Object),
          expect.any(Object),
          TEST_BLOCK
        );
      });

      it('should not create incident when non-monitored validator changes commission', async () => {
        const prefs = { commission: 20, blocked: false };
        const event = suite.createTestEvent('staking', 'ValidatorPrefsSet', ['non-monitored-address', prefs]);
        
        await monitor.processEvent({ eventRecord: event, blockNumber: TEST_BLOCK });
        expect(suite.mockIncidents.oneTimeIncident).not.toHaveBeenCalled();
      });
    });

    describe(H.DestinationChanged, () => {
      it('should create one-time incident when payee is changed via setPayee', async () => {
        const payee = {
          isAccount: false,
          type: 'Controller',
          asAccount: null,
        };
        const call = suite.createTestCall('staking', 'setPayee', [payee]);
    
        await monitor.processCall({ 
          call, 
          origin: TEST_ADDRESS,
          blockNumber: TEST_BLOCK,
          extrinsicIndex: 0
        });
    
        expect(suite.mockIncidents.oneTimeIncident).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.stringContaining('Destination change detected'),
            expect.stringContaining('Destination: Controller')
          ]),
          expect.any(Object),
          expect.any(Object),
          TEST_BLOCK
        );
      });

      it('should create one-time incident when payee is changed via bond', async () => {
        const payee = {
          isAccount: false,
          type: 'Controller',
          asAccount: null,
        };
        const call = suite.createTestCall('staking', 'bond', [
          'controller-address',
          payee,
          BigInt(1000)
        ]);
    
        await monitor.processCall({ 
          call, 
          origin: TEST_ADDRESS,
          blockNumber: TEST_BLOCK,
          extrinsicIndex: 0
        });
    
        expect(suite.mockIncidents.oneTimeIncident).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.stringContaining('Destination change detected'),
            expect.stringContaining('Destination: Controller')
          ]),
          expect.any(Object),
          expect.any(Object),
          TEST_BLOCK
        );
      });
    });
  });

  describe('Block Handlers', () => {
    describe(H.CommissionUnexpected, () => {
      it('should create ongoing incident when commission is above expected', async () => {
        suite.mockStakingState(TEST_ADDRESS, {
          ...DEFAULT_STAKING_STATE,
          commission: 20, // Higher than expected 10
        });

        await monitor.processState({ blockNumber: TEST_BLOCK });

        expect(suite.mockIncidents.ongoingIncident).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.stringContaining('Unexpected commission'),
            expect.stringContaining('Expected 10, got 20')
          ]),
          expect.any(Object),
          true,
          expect.any(Object),
          TEST_BLOCK
        );
      });

      it('should not fire incident when commission is below expected', async () => {
        suite.mockStakingState(TEST_ADDRESS, {
          ...DEFAULT_STAKING_STATE,
          commission: 5,
        });

        await monitor.processState({ blockNumber: TEST_BLOCK });

        expect(suite.mockIncidents.ongoingIncident).toHaveBeenCalledWith(
          expect.any(Object),
          expect.any(Object),
          false,
          expect.any(Object),
          TEST_BLOCK
        );
      });
    });

    describe(H.SelfStakeUnexpected, () => {
      it('should create ongoing incident when self-stake is below expected', async () => {
        suite.mockStakingState(TEST_ADDRESS, {
          ...DEFAULT_STAKING_STATE,
          selfStake: BigInt(500), // Less than expected 1000
        });

        await monitor.processState({ blockNumber: TEST_BLOCK });

        expect(suite.mockIncidents.ongoingIncident).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.stringContaining('Unexpected self-stake'),
            expect.stringContaining('Expected'),
            expect.stringContaining('got')
          ]),
          expect.any(Object),
          true,
          expect.any(Object),
          TEST_BLOCK
        );
      });

      it('should not fire incident when self-stake is above expected', async () => {
        suite.mockStakingState(TEST_ADDRESS, {
          ...DEFAULT_STAKING_STATE,
          selfStake: BigInt(2000),
        });

        await monitor.processState({ blockNumber: TEST_BLOCK });

        expect(suite.mockIncidents.ongoingIncident).toHaveBeenCalledWith(
          expect.any(Object),
          expect.any(Object),
          false,
          expect.any(Object),
          TEST_BLOCK
        );
      });
    });

    describe(H.DestinationUnexpected, () => {
      it('should create ongoing incident for incorrect payee', async () => {
        suite.mockStakingState(TEST_ADDRESS, {
          ...DEFAULT_STAKING_STATE,
          payee: 'Controller', // Expected 'Staked'
        });

        await monitor.processState({ blockNumber: TEST_BLOCK });

        expect(suite.mockIncidents.ongoingIncident).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.stringContaining('Unexpected reward destination'),
            expect.stringContaining('Expected "Staked", got "Controller"')
          ]),
          expect.any(Object),
          true,
          expect.any(Object),
          TEST_BLOCK
        );
      });

      it('should not fire incident for correct payee', async () => {
        await monitor.processState({ blockNumber: TEST_BLOCK });

        expect(suite.mockIncidents.ongoingIncident).toHaveBeenCalledWith(
          expect.any(Object),
          expect.any(Object),
          false,
          expect.any(Object),
          TEST_BLOCK
        );
      });
    });

    describe(H.ActiveSetPresence, () => {
      it('should create ongoing incident when validator is not in active set', async () => {
        suite.mockStakingState(TEST_ADDRESS, {
          ...DEFAULT_STAKING_STATE,
          isValidator: false,
        });

        await monitor.processState({ blockNumber: TEST_BLOCK });

        expect(suite.mockIncidents.ongoingIncident).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.stringContaining('not present in the validation active set'),
            expect.stringContaining('Era: 100')
          ]),
          expect.any(Object),
          true,
          expect.any(Object),
          TEST_BLOCK
        );
      });

      it('should not fire incident when validator is in active set', async () => {
        await monitor.processState({ blockNumber: TEST_BLOCK });

        expect(suite.mockIncidents.ongoingIncident).toHaveBeenCalledWith(
          expect.any(Object),
          expect.any(Object),
          false,
          expect.any(Object),
          TEST_BLOCK
        );
      });
    });

    describe(H.ValidatorIntentionMissing, () => {
      it('should create ongoing incident when account is not bonded', async () => {
        suite.mockStakingState(TEST_ADDRESS, {
          isBonded: false
        });

        await monitor.processState({ blockNumber: TEST_BLOCK });

        const calls = suite.mockIncidents.ongoingIncident.mock.calls;
        const validatorIntentionCall = calls.find(call => call[3].handler === H.ValidatorIntentionMissing);
        expect(validatorIntentionCall).toBeTruthy();

        const [message, , isFiring] = validatorIntentionCall;
        expect(message[0]).toContain('not properly set up as validator');
        expect(message[1]).toContain('Account is not bonded.');
        expect(isFiring).toBe(true);
      });

      it('should create ongoing incident when no validator preferences exist', async () => {
        suite.mockStakingState(TEST_ADDRESS, {
          commission: null
        });

        await monitor.processState({ blockNumber: TEST_BLOCK });

        const calls = suite.mockIncidents.ongoingIncident.mock.calls;
        const validatorIntentionCall = calls.find(call => call[3].handler === H.ValidatorIntentionMissing);
        expect(validatorIntentionCall).toBeTruthy();

        const [message, , isFiring] = validatorIntentionCall;
        expect(message[0]).toContain('not properly set up as validator');
        expect(message[1]).toContain('No validator preferences (commission) set.');
        expect(isFiring).toBe(true);
      });

      it('should not fire incident when properly set up', async () => {
        await monitor.processState({ blockNumber: TEST_BLOCK });

        const calls = suite.mockIncidents.ongoingIncident.mock.calls;
        const validatorIntentionCall = calls.find(call => call[3].handler === H.ValidatorIntentionMissing);
        expect(validatorIntentionCall).toBeTruthy();

        const [, , isFiring] = validatorIntentionCall;
        expect(isFiring).toBe(false);
      });
    });
  });
});
