import { AbstractChainMonitor } from '@lib/chain/monitors/abstract-chain-monitor';
import { Chain, MonitorType, StakingHandlerType as H } from '@w3f/monitoring-types';
import { MonitorTestSuite } from './monitor-test-suite';
import { Event, Call, State, IncidentPayload } from '@lib/common/decorators';

class TestChainMonitor extends AbstractChainMonitor<MonitorType.Staking> {
  @Event(H.SlashReported, [Chain.Polkadot], 'test.event')
  async testEventHandler({ eventRecord, blockNumber, handler }) {
    const address = eventRecord.event.data[0].toString();
    const incidents: IncidentPayload[] = [];
    
    for (const { account, alerts, groupId } of this.getAccounts(handler, address)) {
      const key = { wallet: account.ss58, groupId, handler };
      incidents.push({
        message: ['test'],
        alerts,
        key,
        blockNumber
      });
    }
    
    return incidents;
  }

  @Call(H.DestinationChanged, [Chain.Polkadot], 'test.call')
  async testCallHandler({ call, origin, blockNumber, handler }) {
    const incidents: IncidentPayload[] = [];
    
    for (const { account, alerts, groupId } of this.getAccounts(handler, origin)) {
      const key = { wallet: account.ss58, groupId, handler };
      incidents.push({
        message: ['test'],
        alerts,
        key,
        blockNumber
      });
    }
    
    return incidents;
  }

  @State(H.CommissionUnexpected, [Chain.Polkadot])
  async testBlockHandler({ blockNumber, handler }) {
    const incidents: IncidentPayload[] = [];
    
    for (const address of this.uniqueAddresses) {
      for (const { account, alerts, groupId } of this.getAccounts(handler, address)) {
        const key = { wallet: account.ss58, groupId, handler };
        incidents.push({
          message: ['test'],
          alerts,
          key,
          blockNumber,
          isFiring: true
        });
      }
    }
    
    return incidents;
  }
}

describe('AbstractChainMonitor', () => {
  let suite: MonitorTestSuite;
  let monitor: TestChainMonitor;
  const TEST_BLOCK = 100;
  const TEST_ADDRESS = 'test-address';

  beforeEach(() => {
    suite = new MonitorTestSuite();
    const groups = [suite.createMonitoringGroup({
      accounts: [{
        name: 'Test Account',
        ss58: TEST_ADDRESS,
        hex: '0x1234',
        Staking: {
          commission: 10,
        },
      }],
    })];
    
    monitor = new TestChainMonitor(
      suite.mockLogger,
      groups,
      suite.mockIncidents,
      suite.mockChainProps,
      suite.mockProvider,
      MonitorType.Staking
    );
  });

  describe('Handler Registration', () => {
    it('should properly initialize triggered and periodic handlers', () => {
      const handlerDefs = monitor['getHandlerDefinitions']();
      expect(handlerDefs).toEqual({
        event: { type: 'triggered' },
        call: { type: 'triggered' },
        state: { type: 'periodic' }
      });

      expect(monitor['handlers'].get('event')).toBeInstanceOf(Map);
      expect(monitor['handlers'].get('call')).toBeInstanceOf(Map);
      expect(monitor['handlers'].get('state')).toBeInstanceOf(Set);
    });

    it('should register handlers for supported chains', () => {
      expect(monitor['handlers'].get('event').size).toBe(1);
      expect(monitor['handlers'].get('call').size).toBe(1);
      expect(monitor['handlers'].get('state').size).toBe(1);
    });

    it('should not register handlers for unsupported chains', () => {
      const kusamaGroups = [suite.createMonitoringGroup({
        chain: Chain.Kusama,
        accounts: [{
          name: 'Test Account',
          ss58: TEST_ADDRESS,
          hex: '0x1234',
          Staking: {
            commission: 10,
          },
        }],
      })];

      monitor = new TestChainMonitor(
        suite.mockLogger,
        kusamaGroups,
        suite.mockIncidents,
        { ...suite.mockChainProps, chain: Chain.Kusama },
        suite.mockProvider,
        MonitorType.Staking
      );
      
      expect(monitor['handlers'].get('event').size).toBe(0);
      expect(monitor['handlers'].get('call').size).toBe(0);
      expect(monitor['handlers'].get('state').size).toBe(0);
    });
  });

  describe('Handler Filtering', () => {
    it('should allow all handlers when no configuration provided', async () => {
      const event = suite.createTestEvent('test', 'event', [TEST_ADDRESS]);
      await monitor.processEvent({ eventRecord: event, blockNumber: TEST_BLOCK });
      expect(suite.mockIncidents.oneTimeIncident).toHaveBeenCalled();
    });

    it('should filter handlers based on include list', async () => {
      const groups = [suite.createMonitoringGroup({
        accounts: [{
          name: 'Test Account',
          ss58: TEST_ADDRESS,
          hex: '0x1234',
          Staking: {
            commission: 10,
            handlers: {
              include: [H.SlashReported]
            }
          },
        }],
      })];
      
      monitor = new TestChainMonitor(
        suite.mockLogger,
        groups,
        suite.mockIncidents,
        suite.mockChainProps,
        suite.mockProvider,
        MonitorType.Staking
      );

      const event = suite.createTestEvent('test', 'event', [TEST_ADDRESS]);
      await monitor.processEvent({ eventRecord: event, blockNumber: TEST_BLOCK });
      expect(suite.mockIncidents.oneTimeIncident).toHaveBeenCalled();

      // Reset calls count
      jest.clearAllMocks();

      // This handler should be filtered out
      await monitor.processState({ blockNumber: TEST_BLOCK });
      expect(suite.mockIncidents.ongoingIncident).not.toHaveBeenCalled();
    });

    it('should filter handlers based on exclude list', async () => {
      const groups = [suite.createMonitoringGroup({
        accounts: [{
          name: 'Test Account',
          ss58: TEST_ADDRESS,
          hex: '0x1234',
          Staking: {
            commission: 10,
            handlers: {
              exclude: [H.SlashReported]
            }
          },
        }],
      })];
      
      monitor = new TestChainMonitor(
        suite.mockLogger,
        groups,
        suite.mockIncidents,
        suite.mockChainProps,
        suite.mockProvider,
        MonitorType.Staking
      );

      const event = suite.createTestEvent('test', 'event', [TEST_ADDRESS]);
      await monitor.processEvent({ eventRecord: event, blockNumber: TEST_BLOCK });
      expect(suite.mockIncidents.oneTimeIncident).not.toHaveBeenCalled();

      // This handler should not be filtered out
      await monitor.processState({ blockNumber: TEST_BLOCK });
      expect(suite.mockIncidents.ongoingIncident).toHaveBeenCalled();
    });

    it('should handle multiple accounts with different handler configs', async () => {
      const groups = [suite.createMonitoringGroup({
        accounts: [
          {
            name: 'Test Account 1',
            ss58: TEST_ADDRESS,
            hex: '0x1234',
            Staking: {
              commission: 10,
              handlers: {
                include: [H.SlashReported]
              }
            },
          },
          {
            name: 'Test Account 2',
            ss58: 'other-address',
            hex: '0x5678',
            Staking: {
              commission: 10,
              handlers: {
                exclude: [H.SlashReported]
              }
            },
          }
        ],
      })];
      
      monitor = new TestChainMonitor(
        suite.mockLogger,
        groups,
        suite.mockIncidents,
        suite.mockChainProps,
        suite.mockProvider,
        MonitorType.Staking
      );
    
      // First account has SlashReported in include list, should trigger incident
      const event1 = suite.createTestEvent('test', 'event', [TEST_ADDRESS]);
      await monitor.processEvent({ eventRecord: event1, blockNumber: TEST_BLOCK });
      expect(suite.mockIncidents.oneTimeIncident).toHaveBeenCalledTimes(1);
    
      jest.clearAllMocks();
    
      // Second account has SlashReported in exclude list, should not trigger incident
      const event2 = suite.createTestEvent('test', 'event', ['other-address']);
      await monitor.processEvent({ eventRecord: event2, blockNumber: TEST_BLOCK });
      expect(suite.mockIncidents.oneTimeIncident).not.toHaveBeenCalled();
    });
  });
});
