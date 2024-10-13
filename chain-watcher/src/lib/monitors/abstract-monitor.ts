import { ApiPromise } from '@polkadot/api';
import { BlockHash, Phase } from '@polkadot/types/interfaces';
import { EventRecord } from '@polkadot/types/interfaces/system';
import { Call } from '@polkadot/types/interfaces/runtime';
import { formatBalance } from '@polkadot/util';
import { AccountInfo } from '@polkadot/types/interfaces';
import { Monitor, MonitoringGroup, AccountId, AccountSettings, Logger } from '../interfaces';
import { IncidentHandler } from '../incident/incident-handler';
import { ChainWatcherStore } from '../store/chain-watcher-store';

export abstract class AbstractMonitor implements Monitor {
  protected eventHandlers: Map<string, (eventRecord: EventRecord, blockHash: BlockHash, blockNumber: number) => Promise<void>>;
  protected callHandlers: Map<string, (call: Call, blockHash: BlockHash, blockNumber: number) => Promise<void>>;
  protected blockHandlers: Set<(blockHash: BlockHash, blockNumber: number) => Promise<void>>;
  protected accountGroups: Map<string, { account: AccountId; group: MonitoringGroup }[]> = new Map();
  protected accounts: Array<string>;

  constructor(
    protected logger: Logger,
    protected api: ApiPromise,
    protected groups: MonitoringGroup[],
    protected incidentHandler: IncidentHandler,
    protected store: ChainWatcherStore
  ) {
    // Build accountGroups map for better account lookup
    this.buildAccountGroups();
    this.initializeHandlers();
    // Get all unique accounts from all monitoring groups
    this.accounts = Array.from(new Set(this.groups.flatMap(group => group.accounts.map(account => account.ss58))));
  }

  private initializeHandlers(): void {
    const prototype = Object.getPrototypeOf(this);
    
    this.eventHandlers = new Map();
    if (prototype.eventHandlers instanceof Map) {
      for (const [eventName, methodName] of prototype.eventHandlers) {
        if (typeof this[methodName] === 'function') {
          this.eventHandlers.set(eventName, this[methodName].bind(this));
        }
      }
    }

    this.callHandlers = new Map();
    if (prototype.callHandlers instanceof Map) {
      for (const [callName, methodName] of prototype.callHandlers) {
        if (typeof this[methodName] === 'function') {
          this.callHandlers.set(callName, this[methodName].bind(this));
        }
      }
    }

    this.blockHandlers = new Set();
    if (prototype.blockHandlers instanceof Set) {
      for (const methodName of prototype.blockHandlers) {
        if (typeof this[methodName] === 'function') {
          this.blockHandlers.add(this[methodName].bind(this));
        }
      }
    }
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

  protected getGroups(address: string): { account: AccountSettings; group: MonitoringGroup }[] {
    return this.accountGroups.get(address) || [];
  }

protected async getBalances(blockNumber: number): Promise<Map<string, bigint>> {
  let balances: Map<string, bigint> | null = await this.store.getAccountBalances(blockNumber);
  
  if (!balances) {
    const accountInfos = await this.api.query.system.account.multi<AccountInfo>(this.accounts);
    balances = new Map(
      this.accounts.map((account, index) => [
        account,
        accountInfos[index].data.free.toBigInt()
      ])
    );
    await this.store.setAccountBalances(blockNumber, balances);
  }
  
  return balances;
}


  async processEvent(blockHash: BlockHash, blockNumber: number, eventRecord: EventRecord): Promise<void> {
    const { event } = eventRecord;
    const eventName = `${event.section}.${event.method}`;
    const handler = this.eventHandlers.get(eventName);
    if (handler) {
      await handler(eventRecord, blockHash, blockNumber);
    }
  }

  async processCall(blockHash: BlockHash, blockNumber: number, call: Call): Promise<void> {
    const callName = `${call.section}.${call.method}`;
    const handler = this.callHandlers.get(callName);
    if (handler) {
      await handler(call, blockHash, blockNumber);
    }
  }

  async processBlock(blockHash: BlockHash, blockNumber: number): Promise<void> {
    for (const handler of this.blockHandlers) {
      await handler(blockHash, blockNumber);
    }
  }

  protected async getEventLink(blockHash: BlockHash, phase: Phase): Promise<string> {
    const block = await this.api.rpc.chain.getBlock(blockHash);
    const networkId = (this.api.runtimeVersion.specName).toString();
    if (!phase.isApplyExtrinsic) {
      return ''
    }
    const extrinsicIndex = phase.asApplyExtrinsic.toNumber();
    const blockNumber = block.block.header.number.toNumber();
    return `<a href="https://${networkId}.subscan.io/event?extrinsic=${blockNumber}-${extrinsicIndex}">polkadot.subscan.io</a>`;
  }

  protected formatBalance(amount: number | string | bigint): string {
    return formatBalance(amount, {
      decimals: this.api.registry.chainDecimals[0],
      withUnit: this.api.registry.chainTokens[0],
      withSi: true,
      forceUnit: '-',
    });
  }

}
