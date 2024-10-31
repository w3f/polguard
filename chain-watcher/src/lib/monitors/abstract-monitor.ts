import { ApiPromise } from '@polkadot/api';
import { BlockHash, Phase } from '@polkadot/types/interfaces';
import { EventRecord } from '@polkadot/types/interfaces/system';
import { CallBase } from '@polkadot/types/types/calls';
import { AnyTuple } from '@polkadot/types/types';
import { formatBalance } from '@polkadot/util';
import { Monitor, MonitoringGroup, AccountId, AccountSettings, Logger, EventHandlerParams, CallHandlerParams, BlockHandlerParams } from '../interfaces';
import { IncidentHandler } from '../incident/incident-handler';
import { ChainWatcherStore } from '../store/chain-watcher-store';

export abstract class AbstractMonitor implements Monitor {
  protected eventHandlers: Map<string, (params: EventHandlerParams) => Promise<void>>;
  protected callHandlers: Map<string, (params: CallHandlerParams) => Promise<void>>;
  protected blockHandlers: Set<(params: BlockHandlerParams) => Promise<void>>;
  protected accountGroups: Map<string, { account: AccountId; group: MonitoringGroup }[]> = new Map();
  protected accounts: Array<string>;

  constructor(
    protected logger: Logger,
    protected api: ApiPromise,
    protected groups: MonitoringGroup[],
    protected incidents: IncidentHandler,
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

  async processEvent({ eventRecord, blockHash, blockNumber }: EventHandlerParams): Promise<void> {
    const { event } = eventRecord;
    const eventName = `${event.section}.${event.method}`;
    const handler = this.eventHandlers.get(eventName);
    if (handler) {
      await handler({ eventRecord, blockHash, blockNumber });
    }
  }

  async processCall({ call, origin, blockHash, blockNumber }: CallHandlerParams): Promise<void> {
    const callName = `${call.section}.${call.method}`;
    const handler = this.callHandlers.get(callName);
    if (handler) {
      await handler({ call, origin, blockHash, blockNumber });
    }
  }

  async processBlock({ blockHash, blockNumber }: BlockHandlerParams): Promise<void> {
    for (const handler of this.blockHandlers) {
      await handler({ blockHash, blockNumber });
    }
  }

  protected getEventLink(blockNumber: number, phase: Phase): string {
    if (!phase.isApplyExtrinsic) {
      this.logger.warn(
        `Unable to generate event link: Phase is not ApplyExtrinsic in block ${blockNumber}`
      );
      return '';
    }
    const index = phase.asApplyExtrinsic.toNumber();
    const network = this.getNetwork();
    return `<a href="https://${network}.subscan.io/event?extrinsic=${blockNumber}-${index}">${network}.subscan.io</a>`;
  }

  protected getAccountLink(address: string): string {
    return `<a href="https://${this.getNetwork()}.subscan.io/account/${address}">${this.getNetwork()}.subscan.io</a>`;
  }

  protected async getExtrinsicLink(blockHash: BlockHash, call: CallBase<AnyTuple>): Promise<string> {
    const block = await this.api.rpc.chain.getBlock(blockHash);
    const blockNumber = block.block.header.number.toNumber();
    
    const index = block.block.extrinsics.findIndex(ext => 
      ext.method.section === call.section && ext.method.method === call.method
    );

    if (index === -1) {
      this.logger.warn(
        `Unable to generate extrinsic link: Extrinsic ${call.section}.${call.method} ` +
        `not found in block ${blockNumber}`
      );
      return '';
    }

    const network = this.getNetwork();
    const url = `https://${network}.subscan.io/extrinsic/${blockNumber}-${index}`;

    return `<a href="${url}">${network}.subscan.io</a>`;
  }

  private getNetwork(): string {
    return this.api.runtimeVersion.specName.toString();
  }

  protected formatMessage(title: string, details: string[]): string {
    const formattedDetails = [
      `<li>Network: ${this.getNetwork()}</li>`,
      ...details.map(detail => `<li>${detail}</li>`)
    ].join('');
    return `<b>${title}</b><br/><ul style="list-style-type: none; padding-left: 0;">${formattedDetails}</ul>`;
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
