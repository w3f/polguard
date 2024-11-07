import { ApiPromise } from '@polkadot/api';
import { BlockHash, Phase } from '@polkadot/types/interfaces';
import { CallBase } from '@polkadot/types/types/calls';
import { AnyTuple } from '@polkadot/types/types';
import { formatBalance } from '@polkadot/util';
import {
  Monitor,
  MonitoringGroup,
  Logger,
  EventHandlerParams,
  CallHandlerParams,
  EveryBlockHandlerParams,
  Message,
  MonitorSettings,
  AccountSettings,
  ConfigAccountSettings,
  AlertSettings,
} from '../interfaces';
import { IncidentHandler } from '../incident/incident-handler';
import { ChainWatcherStore } from '../store/chain-watcher-store';
import { MonitorType } from '../constants';

export abstract class AbstractMonitor<T extends MonitorType> implements Monitor {
  protected static monitorType: MonitorType;
  protected eventHandlers: Map<string, (params: EventHandlerParams) => Promise<void>>;
  protected callHandlers: Map<string, (params: CallHandlerParams) => Promise<void>>;
  protected everyBlockHandlers: Set<(params: EveryBlockHandlerParams) => Promise<void>>;
  protected accounts: Map<
    string,
    {
      account: AccountSettings<T>;
      alerts: AlertSettings;
      groupId: string;
    }[]
  > = new Map();
  protected uniqueAddresses: string[];

  constructor(
    protected logger: Logger,
    protected api: ApiPromise,
    protected groups: MonitoringGroup[],
    protected incidents: IncidentHandler,
    protected store: ChainWatcherStore,
    protected monitorType: T,
  ) {
    this.buildAccountMap();
    this.initializeHandlers();
    this.uniqueAddresses = Array.from(this.accounts.keys());
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

    this.everyBlockHandlers = new Set();
    if (prototype.everyBlockHandlers instanceof Set) {
      for (const methodName of prototype.everyBlockHandlers) {
        if (typeof this[methodName] === 'function') {
          this.everyBlockHandlers.add(this[methodName].bind(this));
        }
      }
    }
  }

  /**
   * Builds a map of monitor-specific account settings and associated alert settings.
   *
   * This method processes all accounts from the monitoring groups and organizes them into a map
   * where the key is the account's ss58 address and the value is an array of objects containing
   * the account settings specific to this monitor type and the associated alert settings.
   *
   * @private
   */
  private buildAccountMap(): void {
    for (const group of this.groups) {
      for (const account of group.accounts as ConfigAccountSettings[]) {
        if (!this.accounts.has(account.ss58)) {
          this.accounts.set(account.ss58, []);
        }
        const monitorSettings = account[this.monitorType];
        if (monitorSettings) {
          this.accounts.get(account.ss58).push({
            account: {
              ss58: account.ss58,
              hex: account.hex,
              name: account.name,
              settings: monitorSettings as MonitorSettings<T>,
            },
            alerts: group.alerts,
            // TODO: Consider implementing a deterministic group id.
            // This wouldn't work if two groups with the same name use the same account.
            groupId: group.name,
          });
        }
      }
    }
  }

  protected getAccounts(address: string): {
    account: AccountSettings<T>;
    alerts: AlertSettings;
    groupId: string;
  }[] {
    return this.accounts.get(address) || [];
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

  async processEveryBlock({ blockHash, blockNumber }: EveryBlockHandlerParams): Promise<void> {
    for (const handler of this.everyBlockHandlers) {
      await handler({ blockHash, blockNumber });
    }
  }

  protected getEventLink(blockNumber: number, phase: Phase): string {
    if (!phase.isApplyExtrinsic) {
      this.logger.warn(`Unable to generate event link: Phase is not ApplyExtrinsic in block ${blockNumber}`);
      return '';
    }
    const index = phase.asApplyExtrinsic.toNumber();
    const network = this.getNetwork();
    return `https://${network}.subscan.io/event?extrinsic=${blockNumber}-${index}`;
  }

  protected getAccountLink(address: string): string {
    return `https://${this.getNetwork()}.subscan.io/account/${address}`;
  }

  protected async getExtrinsicLink(blockHash: BlockHash, call: CallBase<AnyTuple>): Promise<string> {
    const block = await this.api.rpc.chain.getBlock(blockHash);
    const blockNumber = block.block.header.number.toNumber();

    const index = block.block.extrinsics.findIndex(
      ext => ext.method.section === call.section && ext.method.method === call.method,
    );

    if (index === -1) {
      this.logger.warn(
        `Unable to generate extrinsic link: Extrinsic ${call.section}.${call.method} ` +
          `not found in block ${blockNumber}`,
      );
      return '';
    }

    const network = this.getNetwork();
    return `https://${network}.subscan.io/extrinsic/${blockNumber}-${index}`;
  }

  private getNetwork(): string {
    return this.api.runtimeVersion.specName.toString();
  }

  protected createMessage(rows: string[]): Message {
    rows.push(`Network: ${this.getNetwork()}`);
    return { title: rows.shift(), details: rows };
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
