import { ApiPromise } from '@polkadot/api';
import { BlockHash, Phase } from '@polkadot/types/interfaces';
import { EventRecord } from '@polkadot/types/interfaces/system';
import { Call } from '@polkadot/types/interfaces/runtime';
import { formatBalance } from '@polkadot/util';
import { Monitor, MonitorHandler, MonitoringGroup, Incident, AccountId } from '../interfaces';
import EventEmitter from 'events';

export abstract class AbstractMonitor implements Monitor {
  protected incidentEmitter: EventEmitter;
  protected eventHandlers: Map<string, string> = new Map();
  protected callHandlers: Map<string, string> = new Map();
  protected blockHandlers: Map<string, string> = new Map();
  protected accountGroups: Map<string, { account: AccountId; group: MonitoringGroup }[]> = new Map();

  constructor(
    protected api: ApiPromise,
    protected groups: MonitoringGroup[],
    incidentEmitter: EventEmitter
  ) {
    this.incidentEmitter = incidentEmitter;
    // Initialize event handlers
    const constructor = this.constructor as any;
    if (constructor.eventHandlers) {
      this.eventHandlers = constructor.eventHandlers;
    }

    // Build accountGroups map for better account lookup
    this.buildAccountGroups();
  }

  private buildAccountGroups(): void {
    for (const group of this.groups) {
      for (const account of group.accounts) {
        if (!this.accountGroups.has(account.ss58)) {
          this.accountGroups.set(account.ss58, []);
        }
        this.accountGroups.get(account.ss58).push({ account, group });
      }
    }
  }  

  protected emitIncident(incident: Incident): void {
    this.incidentEmitter.emit('newIncident', incident);
  }

  async processEvent(blockHash: BlockHash, eventRecord: EventRecord): Promise<void> {
    const { event } = eventRecord;
    const eventName = `${event.section}.${event.method}`;

    const handlerName = this.eventHandlers.get(eventName);
    if (handlerName && typeof this[handlerName] === 'function') {
      await this[handlerName](eventRecord, blockHash);
    }
  }

  async processBlock(blockHash: BlockHash, blockNumber: number): Promise<void> {
  
  }

  async processCall(blockHash: BlockHash, call: Call): Promise<void> {

  }

  async getEventLink(blockHash: BlockHash, phase: Phase): Promise<string> {
    const block = await this.api.rpc.chain.getBlock(blockHash);
    const networkId = (this.api.runtimeVersion.specName).toString();
    if (!phase.isApplyExtrinsic) {
      return ''
    }
    const extrinsicIndex = phase.asApplyExtrinsic.toNumber();
    const blockNumber = block.block.header.number.toNumber();
    return `https://${networkId}.subscan.io/event?extrinsic=${blockNumber}-${extrinsicIndex}`;
  }

  formatBalance(amount: number | string | bigint): string {
    return formatBalance(amount, {
      decimals: this.api.registry.chainDecimals[0],
      withUnit: this.api.registry.chainTokens[0],
      withSi: true,
      forceUnit: '-',
    });
  }

}
