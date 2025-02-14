import { MonitorTestSuite } from './monitor-test-suite';
import { IdentityMonitor } from '@lib/chain/monitors/identity/identity-monitor';
import { MonitorType, IdentityHandlerType as H, Chain } from '@w3f/monitoring-types';

describe('IdentityMonitor', () => {
  let suite: MonitorTestSuite;
  let monitor: IdentityMonitor;
  const TEST_BLOCK = 100;
  const TEST_ADDRESS = 'test-address';
  const DEFAULT_IDENTITY = {
    display: 'Test Display Name',
    web: 'https://test.com',
    email: 'test@example.com',
    twitter: '@test',
  };

  beforeEach(() => {
    suite = new MonitorTestSuite();
    const groups = [suite.createMonitoringGroup({
      accounts: [{
        name: 'Test Account',
        ss58: TEST_ADDRESS,
        hex: '0x1234',
        Identity: DEFAULT_IDENTITY,
      }],
      chain: Chain.PeoplePolkadot,
    })];
    
    monitor = new IdentityMonitor(
      suite.mockLogger,
      groups,
      suite.mockIncidents,
      { ...suite.mockChainProps, chain: Chain.PeoplePolkadot },
      suite.mockProvider,
      MonitorType.Identity
    );

    // Setup default mock response
    suite.mockIdentitySuperOf({ [TEST_ADDRESS]: null });
    suite.mockProvider.identityOf.mockResolvedValue({
      [TEST_ADDRESS]: DEFAULT_IDENTITY,
    });
  });

  describe('Event Handlers', () => {
    describe(H.IdentityChanged, () => {
      it('should create one-time incident when identity is set', async () => {
        const event = suite.createTestEvent('identity', 'IdentitySet', [TEST_ADDRESS]);
        
        suite.mockProvider.identityOf
          .mockImplementation((addresses: string[], blockNumber: number) => 
            Promise.resolve({
              [TEST_ADDRESS]: blockNumber === TEST_BLOCK - 1 
                ? null 
                : { ...DEFAULT_IDENTITY, display: 'New Display Name' }
            })
          );

        await monitor.processEvent({ eventRecord: event, blockNumber: TEST_BLOCK });

        expect(suite.mockIncidents.oneTimeIncident).toHaveBeenCalledWith(
          expect.objectContaining({
            title: expect.stringContaining('Identity change detected'),
            details: expect.arrayContaining([
              expect.stringContaining('display: "Not set" → "New Display Name"')
            ])
          }),
          expect.any(Object),
          TEST_BLOCK
        );
      });

      it('should create one-time incident when identity is cleared', async () => {
        const event = suite.createTestEvent('identity', 'IdentityCleared', [TEST_ADDRESS]);
        
        suite.mockProvider.identityOf
          .mockImplementation((addresses: string[], blockNumber: number) => 
            Promise.resolve({
              [TEST_ADDRESS]: blockNumber === TEST_BLOCK - 1 
                ? DEFAULT_IDENTITY
                : null
            })
          );

        await monitor.processEvent({ eventRecord: event, blockNumber: TEST_BLOCK });

        expect(suite.mockIncidents.oneTimeIncident).toHaveBeenCalledWith(
          expect.objectContaining({
            title: expect.stringContaining('Identity change detected'),
            details: expect.arrayContaining([
              expect.stringContaining('display: "Test Display Name" → "Not set"')
            ])
          }),
          expect.any(Object),
          TEST_BLOCK
        );
      });

      it('should handle identity changes for sub-identities', async () => {
        const PARENT_ADDRESS = 'parent-address';
        suite.mockIdentitySuperOf({ [TEST_ADDRESS]: PARENT_ADDRESS });
        
        const event = suite.createTestEvent('identity', 'IdentitySet', [PARENT_ADDRESS]);
        
        suite.mockProvider.identityOf
          .mockImplementation((addresses: string[], blockNumber: number) => 
            Promise.resolve({
              [PARENT_ADDRESS]: blockNumber === TEST_BLOCK - 1 
                ? DEFAULT_IDENTITY
                : { ...DEFAULT_IDENTITY, display: 'New Display Name' }
            })
          );

        await monitor.processEvent({ eventRecord: event, blockNumber: TEST_BLOCK });

        expect(suite.mockIncidents.oneTimeIncident).toHaveBeenCalledWith(
          expect.objectContaining({
            title: expect.stringContaining('Identity change detected'),
            details: expect.arrayContaining([
              expect.stringContaining('display: "Test Display Name" → "New Display Name"')
            ])
          }),
          expect.any(Object),
          TEST_BLOCK
        );
      });

      it('should not create incident when non-monitored account changes identity', async () => {
        const event = suite.createTestEvent('identity', 'IdentitySet', ['non-monitored-address']);
        await monitor.processEvent({ eventRecord: event, blockNumber: TEST_BLOCK });
        expect(suite.mockIncidents.oneTimeIncident).not.toHaveBeenCalled();
      });

      it('should not create incident when parent of non-monitored account changes identity', async () => {
        const PARENT_ADDRESS = 'parent-address';
        suite.mockIdentitySuperOf({ 'non-monitored-address': PARENT_ADDRESS });
        
        const event = suite.createTestEvent('identity', 'IdentitySet', [PARENT_ADDRESS]);
        await monitor.processEvent({ eventRecord: event, blockNumber: TEST_BLOCK });
        expect(suite.mockIncidents.oneTimeIncident).not.toHaveBeenCalled();
      });
    });
  });

  describe('Block Handlers', () => {
    describe(H.IdentityUnexpected, () => {
      it('should create ongoing incident when identity fields mismatch', async () => {
        suite.mockProvider.identityOf.mockResolvedValue({
          [TEST_ADDRESS]: {
            ...DEFAULT_IDENTITY,
            display: 'Wrong Display Name',
          },
        });

        await monitor.processEveryBlock({ blockNumber: TEST_BLOCK });

        expect(suite.mockIncidents.ongoingIncident).toHaveBeenCalledWith(
          expect.objectContaining({
            title: expect.stringContaining('Unexpected identity fields'),
            details: expect.arrayContaining([
              expect.stringContaining('display: expected "Test Display Name", got "Wrong Display Name"')
            ])
          }),
          expect.any(Object),
          expect.any(String),
          true,
          TEST_BLOCK
        );
      });

      it('should check parent identity for sub-identities', async () => {
        const PARENT_ADDRESS = 'parent-address';
        suite.mockIdentitySuperOf({ [TEST_ADDRESS]: PARENT_ADDRESS });
        
        suite.mockProvider.identityOf.mockResolvedValue({
          [PARENT_ADDRESS]: {
            ...DEFAULT_IDENTITY,
            display: 'Wrong Display Name',
          },
        });

        await monitor.processEveryBlock({ blockNumber: TEST_BLOCK });

        expect(suite.mockIncidents.ongoingIncident).toHaveBeenCalledWith(
          expect.objectContaining({
            title: expect.stringContaining('Unexpected identity fields'),
            details: expect.arrayContaining([
              expect.stringContaining('display: expected "Test Display Name", got "Wrong Display Name"')
            ])
          }),
          expect.any(Object),
          expect.any(String),
          true,
          TEST_BLOCK
        );
      });

      it('should create ongoing incident when field is missing', async () => {
        const { email, ...identityWithoutEmail } = DEFAULT_IDENTITY;
        suite.mockProvider.identityOf.mockResolvedValue({
          [TEST_ADDRESS]: identityWithoutEmail,
        });

        await monitor.processEveryBlock({ blockNumber: TEST_BLOCK });

        expect(suite.mockIncidents.ongoingIncident).toHaveBeenCalledWith(
          expect.objectContaining({
            title: expect.stringContaining('Unexpected identity fields'),
            details: expect.arrayContaining([
              expect.stringContaining('email: expected "test@example.com", got "Not set"')
            ])
          }),
          expect.any(Object),
          expect.any(String),
          true,
          TEST_BLOCK
        );
      });

      it('should not fire incident when all fields match', async () => {
        await monitor.processEveryBlock({ blockNumber: TEST_BLOCK });

        expect(suite.mockIncidents.ongoingIncident).toHaveBeenCalledWith(
          expect.any(Object),
          expect.any(Object),
          expect.any(String),
          false,
          TEST_BLOCK
        );
      });
      
      it('should create non-firing incident when no fields are configured', async () => {
        const groups = [suite.createMonitoringGroup({
          accounts: [{
            name: 'Test Account',
            ss58: TEST_ADDRESS,
            hex: '0x1234',
            Identity: {}, // No expected fields
          }],
          chain: Chain.PeoplePolkadot,
        })];
        
        monitor = new IdentityMonitor(
          suite.mockLogger,
          groups,
          suite.mockIncidents,
          { ...suite.mockChainProps, chain: Chain.PeoplePolkadot },
          suite.mockProvider,
          MonitorType.Identity
        );

        suite.mockIdentitySuperOf({ [TEST_ADDRESS]: null });

        await monitor.processEveryBlock({ blockNumber: TEST_BLOCK });

        expect(suite.mockIncidents.ongoingIncident).toHaveBeenCalledWith(
          expect.objectContaining({
            title: expect.stringContaining('Unexpected identity fields'),
            details: expect.not.arrayContaining([
              expect.stringContaining('expected')
            ])
          }),
          expect.any(Object),
          expect.any(String),
          false,
          TEST_BLOCK
        );
      });
    });
  });
});
