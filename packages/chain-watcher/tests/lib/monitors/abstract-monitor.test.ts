import { AbstractMonitor } from '@lib/monitors/abstract-monitor';
import { Chain, MonitorType, StakingHandlerType as H } from '@w3f/monitoring-types';
import { MonitorTestSuite } from './monitor-test-suite';
import { EventHandler, CallHandler, EveryBlockHandler } from '@lib/decorators';

class TestMonitor extends AbstractMonitor<MonitorType.Staking> {
  @EventHandler('test.event', [Chain.Polkadot])
  async testEventHandler({ eventRecord, blockNumber }) {
    const address = eventRecord.event.data[0].toString();
    for (const { account, alerts } of this.getAccounts(H.SlashReported, address)) {
      await this.incidents.oneTimeIncident({ title: 'test', details: [] }, alerts, blockNumber);
    }
  }

  @CallHandler('test.call', [Chain.Polkadot])
  async testCallHandler({ call, origin, blockNumber }) {
    for (const { account, alerts } of this.getAccounts(H.DestinationChanged, origin)) {
      await this.incidents.oneTimeIncident({ title: 'test', details: [] }, alerts, blockNumber);
    }
  }

  @EveryBlockHandler([Chain.Polkadot])
  async testBlockHandler({ blockNumber }) {
    for (const address of this.uniqueAddresses) {
      for (const { account, alerts } of this.getAccounts(H.CommissionUnexpected, address)) {
        await this.incidents.oneTimeIncident({ title: 'test', details: [] }, alerts, blockNumber);
      }
    }
  }
}

describe('AbstractMonitor', () => {
  let suite: MonitorTestSuite;
  let monitor: TestMonitor;
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
    
    monitor = new TestMonitor(
      suite.mockLogger,
      groups,
      suite.mockIncidents,
      suite.mockStateQuery,
      suite.mockChainProps,
      MonitorType.Staking
    );
  });

  describe('Handler Registration', () => {
    it('should register handlers for supported chains', () => {
      expect(monitor['eventHandlers'].size).toBe(1);
      expect(monitor['callHandlers'].size).toBe(1);
      expect(monitor['everyBlockHandlers'].size).toBe(1);
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

      monitor = new TestMonitor(
        suite.mockLogger,
        kusamaGroups,
        suite.mockIncidents,
        suite.mockStateQuery,
        { ...suite.mockChainProps, chain: Chain.Kusama },
        MonitorType.Staking
      );
      
      expect(monitor['eventHandlers'].size).toBe(0);
      expect(monitor['callHandlers'].size).toBe(0);
      expect(monitor['everyBlockHandlers'].size).toBe(0);
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
      
      monitor = new TestMonitor(
        suite.mockLogger,
        groups,
        suite.mockIncidents,
        suite.mockStateQuery,
        suite.mockChainProps,
        MonitorType.Staking
      );

      const event = suite.createTestEvent('test', 'event', [TEST_ADDRESS]);
      await monitor.processEvent({ eventRecord: event, blockNumber: TEST_BLOCK });
      expect(suite.mockIncidents.oneTimeIncident).toHaveBeenCalled();

      // Reset calls count
      jest.clearAllMocks();

      // This handler should be filtered out
      await monitor.processEveryBlock({ blockNumber: TEST_BLOCK });
      expect(suite.mockIncidents.oneTimeIncident).not.toHaveBeenCalled();
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
      
      monitor = new TestMonitor(
        suite.mockLogger,
        groups,
        suite.mockIncidents,
        suite.mockStateQuery,
        suite.mockChainProps,
        MonitorType.Staking
      );

      const event = suite.createTestEvent('test', 'event', [TEST_ADDRESS]);
      await monitor.processEvent({ eventRecord: event, blockNumber: TEST_BLOCK });
      expect(suite.mockIncidents.oneTimeIncident).not.toHaveBeenCalled();

      // This handler should not be filtered out
      await monitor.processEveryBlock({ blockNumber: TEST_BLOCK });
      expect(suite.mockIncidents.oneTimeIncident).toHaveBeenCalled();
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
      
      monitor = new TestMonitor(
        suite.mockLogger,
        groups,
        suite.mockIncidents,
        suite.mockStateQuery,
        suite.mockChainProps,
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