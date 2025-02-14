import { 
  Logger, 
  ChainDataProvider, 
  ChainProperties,
  MonitoringGroup,
  AlertSettings,
  Chain,
  MonitorType,
  MessengerType,
  IdentityField,
} from '@w3f/monitoring-types';
import { IncidentHandler } from '@lib/common/incident-handler';
import { EventRecord } from '@polkadot/types/interfaces';
import { Event, Phase } from '@polkadot/types/interfaces/system';
import { AnyTuple, CallBase } from '@polkadot/types/types';

export class MonitorTestSuite {
  mockLogger: jest.Mocked<Logger>;
  mockIncidents: jest.Mocked<IncidentHandler>;
  mockProvider: jest.Mocked<ChainDataProvider>;
  mockChainProps: ChainProperties;
  protected currentBlock: number = 100;
  protected defaultAddress: string = 'test-address';

  constructor() {
    this.setupMocks();
  }

  protected setupMocks() {
    this.mockLogger = {
      debug: jest.fn(),
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      verbose: jest.fn(),
      fatal: jest.fn(),
    };

    this.mockIncidents = {
      oneTimeIncident: jest.fn().mockResolvedValue(undefined),
      ongoingIncident: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<IncidentHandler>;

    this.mockProvider = {
      stakingValidators: jest.fn(),
      stakingValidatorsCommission: jest.fn(),
      stakingLedgerActive: jest.fn(),
      stakingBonded: jest.fn(),
      stakingPayee: jest.fn(),
      stakingActiveEra: jest.fn(),
      sessionValidators: jest.fn(),
      systemAccountBalance: jest.fn(),
      identityOf: jest.fn(),
      identitySuperOf: jest.fn(),
    };

    this.mockChainProps = {
      chain: Chain.Polkadot,
      specName: 'polkadot',
      chainDecimals: 10,
      chainToken: 'DOT',
      ss58Format: 0,
    };
  }

  createMonitoringGroup(overrides: Partial<MonitoringGroup> = {}): MonitoringGroup {
    return {
      name: 'Test Group',
      chain: Chain.Polkadot,
      alerts: this.createDefaultAlerts(),
      accounts: [],
      monitors: [{ name: MonitorType.Staking }],
      ...overrides,
    };
  }

  createDefaultAlerts(): AlertSettings {
    return {
      messengerType: MessengerType.Matrix,
      targets: ['test-room-id']
    };
  }

  createTestAccount(settings: any = {}) {
    return {
      name: 'Test Account',
      ss58: this.defaultAddress,
      hex: '0x1234',
      ...settings,
    };
  }

  createMonitorConfig(monitorType: MonitorType, chain: Chain = Chain.Polkadot) {
    return {
      ...this.mockChainProps,
      chain,
    };
  }

  public createTestEvent(
    section: string, 
    method: string, 
    data: any[], 
    phase = { isApplyExtrinsic: true, asApplyExtrinsic: 0 }
  ) {
    const mockEvent = {
      section,
      method,
      data,
      toHuman: () => ({ section, method, data }),
    } as unknown as Event;

    const mockPhase = {
      isApplyExtrinsic: true,
      asApplyExtrinsic: {
        toNumber: () => 0
      },
      toString: () => '0',
    } as unknown as Phase;

    const mockEventRecord = {
      event: mockEvent,
      phase: mockPhase,
    } as unknown as EventRecord;

    return mockEventRecord;
  }

  public createTestCall(
    section: string,
    method: string,
    args: any[]
  ) {
    return {
      section,
      method,
      args,
      toHuman: () => ({ section, method, args }),
    } as unknown as CallBase<AnyTuple>;
  }

  public mockIdentityState(address: string, identity: any) {
    this.mockProvider.identityOf.mockResolvedValue({
      [address]: identity,
    });
  }

  public mockIdentityStateChange(address: string, previousIdentity: any, currentIdentity: any) {
    this.mockProvider.identityOf
      .mockImplementation((addresses: string[], blockNumber: number) => 
        Promise.resolve({
          [address]: blockNumber === this.currentBlock - 1 
            ? previousIdentity 
            : currentIdentity
        })
      );
  }

  public mockIdentitySuperOf(mapping: Record<string, string | null>) {
    this.mockProvider.identitySuperOf.mockResolvedValue(mapping);
  }

  public mockIdentityWithSuper(address: string, identity: any, parentAddress?: string) {
    this.mockIdentitySuperOf({
      [address]: parentAddress || null
    });

    this.mockProvider.identityOf.mockResolvedValue({
      [parentAddress || address]: identity
    });
  }

  public createTestIdentity(fields: Partial<Record<IdentityField, string>> = {}) {
    return {
      display: 'Test Display Name',
      web: 'https://test.com',
      email: 'test@example.com',
      twitter: '@test',
      ...fields,
    };
  }

  public mockStakingState(address: string, {
    commission = 10,
    selfStake = BigInt(1000),
    payee = 'Staked',
    isValidator = true,
    isBonded = true,
  } = {}) {
    this.mockProvider.stakingValidatorsCommission.mockResolvedValue({
      [address]: commission,
    });
    this.mockProvider.stakingLedgerActive.mockResolvedValue({
      [address]: selfStake,
    });
    this.mockProvider.stakingPayee.mockResolvedValue({
      [address]: payee,
    });
    this.mockProvider.stakingBonded.mockResolvedValue({
      [address]: isBonded ? address : null,
    });
    this.mockProvider.sessionValidators.mockResolvedValue({
      [address]: isValidator,
    });
  }

  expectOngoingIncident(titleFragment: string, blockNumber: number, isFiring: boolean) {
    expect(this.mockIncidents.ongoingIncident).toHaveBeenCalledWith(
      expect.objectContaining({ 
        title: expect.stringContaining(titleFragment),
      }),
      expect.any(Object),
      expect.any(String),
      isFiring,
      blockNumber
    );
  }

  expectOneTimeIncident(titleFragment: string, blockNumber: number) {
    expect(this.mockIncidents.oneTimeIncident).toHaveBeenCalledWith(
      expect.objectContaining({ 
        title: expect.stringContaining(titleFragment),
      }),
      expect.any(Object),
      blockNumber
    );
  }
}
