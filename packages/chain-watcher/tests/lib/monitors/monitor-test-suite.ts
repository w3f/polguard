import { 
  Logger, 
  StateQueryProvider, 
  ChainProperties,
  MonitoringGroup,
  AlertSettings,
  Chain, MonitorType, MessengerType,
} from '@w3f/monitoring-types';
import { IncidentHandler } from '@lib/incident/incident-handler';
import { EventRecord } from '@polkadot/types/interfaces';
import { Event, Phase } from '@polkadot/types/interfaces/system';
import { AnyTuple, CallBase } from '@polkadot/types/types';

export class MonitorTestSuite {
  mockLogger: jest.Mocked<Logger>;
  mockIncidents: jest.Mocked<IncidentHandler>;
  mockStateQuery: jest.Mocked<StateQueryProvider>;
  mockChainProps: ChainProperties;

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

    const incidentHandler = new IncidentHandler(
      this.mockLogger,
      {} as any, // store
      {} as any, // eventEmitter
      Chain.Polkadot
    );

    this.mockIncidents = jest.mocked(incidentHandler);
    jest.spyOn(this.mockIncidents, 'oneTimeIncident').mockImplementation(jest.fn());
    jest.spyOn(this.mockIncidents, 'ongoingIncident').mockImplementation(jest.fn());

    this.mockStateQuery = {
      stakingValidatorsComission: jest.fn(),
      stakingLedgerActive: jest.fn(),
      stakingBonded: jest.fn(),
      stakingPayee: jest.fn(),
      stakingActiveEra: jest.fn(),
      sessionValidators: jest.fn(),
      systemAccountBalance: jest.fn(),
      identityOf: jest.fn(),
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

  expectOngoingIncident(titleFragment: string, blockNumber: number, isFiring: boolean) {
    expect(this.mockIncidents.ongoingIncident).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringContaining(titleFragment) }),
      expect.any(Object),
      blockNumber,
      expect.any(String),
      isFiring
    );
  }

  expectOneTimeIncident(titleFragment: string, blockNumber: number) {
    expect(this.mockIncidents.oneTimeIncident).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringContaining(titleFragment) }),
      expect.any(Object),
      blockNumber
    );
  }
}