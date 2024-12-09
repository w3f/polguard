import { ApiPromise, WsProvider } from '@polkadot/api';
import {
  StateQueryProvider,
  DataStoreClient,
  Logger,
  MonitoringGroup,
  ChainProperties,
  ConfigAccountSettings,
} from '@lib/interfaces';
import { IncidentHandler } from '@lib/incident/incident-handler';
import { Chain, MonitorType } from '@lib/constants';
import { createApiStateQueryProvider } from '@lib/providers/state-provider';
import { createMockLogger, createMockStore } from './mocks';
import {
  BalanceDecrementMonitor,
  BalanceIncrementMonitor,
  BalanceThresholdMonitor,
  GovernanceMonitor,
  TransactionEgressMonitor,
  TransactionIngressMonitor,
  ValidatorMonitor,
} from '@lib/monitors';

export class MonitorTestSuite {
  private api: ApiPromise;
  private stateQuery: StateQueryProvider;
  private incidents: IncidentHandler;
  private logger: Logger;
  private store: DataStoreClient;
  private mockAccounts: ConfigAccountSettings[] = [];
  private incidentCount: number = 0;

  constructor(private wsEndpoint: string) {
    this.logger = createMockLogger();
    this.store = createMockStore();
  }

  private static monitorClassMap: Record<MonitorType, any> = {
    [MonitorType.Validator]: ValidatorMonitor,
    [MonitorType.Governance]: GovernanceMonitor,
    [MonitorType.TransactionIngress]: TransactionIngressMonitor,
    [MonitorType.TransactionEgress]: TransactionEgressMonitor,
    [MonitorType.BalanceIncrement]: BalanceIncrementMonitor,
    [MonitorType.BalanceDecrement]: BalanceDecrementMonitor,
    [MonitorType.BalanceThreshold]: BalanceThresholdMonitor,
  };

  async initialize(): Promise<void> {
    try {
      const provider = new WsProvider(this.wsEndpoint);
      this.api = await ApiPromise.create({ provider, noInitWarn: true });
      await this.api.isReady;
      this.stateQuery = createApiStateQueryProvider(this.api, this.store);
      this.incidents = new IncidentHandler(this.logger, this.store, { emit: async () => true }, Chain.Polkadot);
    } catch (error) {
      console.error('Failed to initialize MonitorTestSuite:', error);
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    await this.api.disconnect();
    // To exit gracefully
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  async getBlockHash(blockNumber: number): Promise<string> {
    return (await this.api.rpc.chain.getBlockHash(blockNumber)).toString();
  }

  addMockAccount(ss58: string, monitorType: MonitorType, settings: Record<string, any> = {}): void {
    this.mockAccounts.push({
      ss58,
      hex: '',
      name: ss58,
      [monitorType]: settings,
    });
  }

  clearMockAccounts(): void {
    this.mockAccounts = [];
  }

  private createMockMonitor(monitorType: MonitorType): any {
    const HandlerClass = MonitorTestSuite.monitorClassMap[monitorType];
    if (!HandlerClass) {
      throw new Error(`No handler class found for monitor type: ${monitorType}`);
    }

    const groups: MonitoringGroup[] = [
      {
        name: 'TestGroup',
        chain: Chain.Polkadot,
        monitors: [{ name: monitorType }],
        accounts: this.mockAccounts,
        alerts: { matrix: { targets: ['test'] } },
      },
    ];

    const chainProps: ChainProperties = {
      ss58Format: 0,
      chainDecimals: 10,
      chainToken: 'DOT',
      specName: 'polkadot',
    };

    return new HandlerClass(this.logger, groups, this.incidents, this.stateQuery, chainProps, monitorType);
  }

  async testEvent(
    monitorType: MonitorType,
    eventName: string,
    blockNumber: number,
    expectedIncidents: number,
  ): Promise<void> {
    const monitor = this.createMockMonitor(monitorType);
    const blockHash = await this.getBlockHash(blockNumber);
    const apiAt = await this.api.at(blockHash);
    const events = await apiAt.query.system.events();

    this.resetIncidentCount();

    for (const eventRecord of events) {
      const { event } = eventRecord;
      const currentEventName = `${event.section}.${event.method}`;
      if (currentEventName === eventName) {
        await monitor.processEvent({ eventRecord, blockNumber });
      }
    }

    this.verifyIncidentCount(expectedIncidents);
  }

  async testCall(
    monitorType: MonitorType,
    callName: string,
    blockNumber: number,
    expectedIncidents: number,
  ): Promise<void> {
    const monitor = this.createMockMonitor(monitorType);
    const blockHash = await this.getBlockHash(blockNumber);
    const block = await this.api.rpc.chain.getBlock(blockHash);

    this.resetIncidentCount();

    for (let i = 0; i < block.block.extrinsics.length; i++) {
      const call = block.block.extrinsics[i].method;
      const origin = block.block.extrinsics[i].signer.toString();
      if (`${call.section}.${call.method}` === callName) {
        await monitor.processCall({ call, origin, blockNumber, extrinsicIndex: i });
      }
    }

    this.verifyIncidentCount(expectedIncidents);
  }

  async testEveryBlock(
    monitorType: MonitorType,
    handlerName: string,
    blockNumber: number,
    expectedIncidents: number,
  ): Promise<void> {
    const monitor = this.createMockMonitor(monitorType);

    this.resetIncidentCount();

    if (typeof monitor[handlerName] === 'function') {
      await monitor[handlerName]({ blockNumber });
    } else {
      throw new Error(`Handler '${handlerName}' not found in monitor`);
    }

    this.verifyIncidentCount(expectedIncidents);
  }

  private resetIncidentCount(): void {
    this.incidentCount = 0;
    this.incidents.oneTimeIncident = async () => {
      this.incidentCount++;
    };
    this.incidents.ongoingIncident = async (message, alerts, blockNumber, key, isFiring) => {
      if (isFiring) this.incidentCount++;
    };
  }

  private verifyIncidentCount(expectedIncidents: number): void {
    if (this.incidentCount !== expectedIncidents) {
      throw new Error(`Expected ${expectedIncidents} incidents, but got ${this.incidentCount}`);
    }
  }
}
