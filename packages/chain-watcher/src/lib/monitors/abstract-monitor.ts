import { Phase } from '@polkadot/types/interfaces';
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
  ChainProperties,
  StateQueryProvider,
  AccountId,
  IncidentHandlerClient,
  ComparisonType,
  MonitorType,
  MonitorHandlerType,
} from '@w3f/monitoring-types';

type AccountConfig<T extends MonitorType> = {
  account: AccountSettings<T>;
  alerts: AlertSettings;
  groupId: string;
};

export abstract class AbstractMonitor<T extends MonitorType> implements Monitor {
  protected static monitorType: MonitorType;
  protected static readonly comparisonFunctions: Record<
    ComparisonType,
    <T extends number | bigint>(a: T, b: T) => boolean
  > = {
    [ComparisonType.Equal]: (a, b) => a === b,
    [ComparisonType.GreaterThan]: (a, b) => a > b,
    [ComparisonType.LessThan]: (a, b) => a < b,
    [ComparisonType.GreaterThanOrEqual]: (a, b) => a >= b,
    [ComparisonType.LessThanOrEqual]: (a, b) => a <= b,
  };
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
    protected groups: MonitoringGroup[],
    protected incidents: IncidentHandlerClient,
    protected stateQuery: StateQueryProvider,
    protected chainProps: ChainProperties,
    protected monitorType: T,
  ) {
    this.buildAccountLookup();
    this.initializeHandlers();
    this.uniqueAddresses = Array.from(this.accounts.keys());
  }

  private initializeHandlers(): void {
    const prototype = Object.getPrototypeOf(this);

    this.eventHandlers = new Map();
    if (prototype.eventHandlers instanceof Map) {
      for (const [eventName, metadata] of prototype.eventHandlers) {
        if (typeof this[metadata.method] === 'function' && metadata.chains.includes(this.chainProps.chain)) {
          this.eventHandlers.set(eventName, this[metadata.method].bind(this));
        }
      }
    }

    this.callHandlers = new Map();
    if (prototype.callHandlers instanceof Map) {
      for (const [callName, metadata] of prototype.callHandlers) {
        if (typeof this[metadata.method] === 'function' && metadata.chains.includes(this.chainProps.chain)) {
          this.callHandlers.set(callName, this[metadata.method].bind(this));
        }
      }
    }

    this.everyBlockHandlers = new Set();
    if (prototype.everyBlockHandlers instanceof Map) {
      for (const [, metadata] of prototype.everyBlockHandlers) {
        if (typeof this[metadata.method] === 'function' && metadata.chains.includes(this.chainProps.chain)) {
          this.everyBlockHandlers.add(this[metadata.method].bind(this));
        }
      }
    }
  }

  /**
   * Gets account configurations filtered by handler eligibility.
   *
   * Each address can have multiple account configurations when same account is monitored
   * by different groups with different settings. This method filters account configurations
   * based on handler configuration:
   *
   * - If no handlers configuration provided - all account configurations are returned
   * - If include list is provided - only configurations that include the handler are returned
   * - If exclude list is provided - only configurations that don't exclude the handler are returned
   *
   * @param handler - Handler type to check eligibility for
   * @param address - Account address to get configurations for
   * @returns Array of account configurations that are eligible for the handler
   */
  protected getAccounts(handler: MonitorHandlerType[T], address: string): AccountConfig<T>[] {
    const accounts = this.accounts.get(address) || [];

    return accounts.filter(account => {
      const handlers = account.account.settings?.handlers;
      if (!handlers) return true;

      if ('include' in handlers) {
        return (handlers.include as MonitorHandlerType[T][]).includes(handler);
      }
      return !(handlers.exclude as MonitorHandlerType[T][]).includes(handler);
    });
  }

  /**
   * Builds account lookup structures for the monitor.
   *
   * This method processes all accounts from the monitoring groups and creates two lookup structures:
   * 1. Main account lookup - maps ss58 address to array of account configurations. Multiple configurations
   *    for the same address are possible when same account is monitored by different groups with different
   *    settings. Using Map for O(1) address lookups.
   * 2. Handler eligibility lookup - maps ss58 address to set of enabled handlers based on include/exclude
   *    configuration. Using Map for O(1) handler eligibility checks.
   *
   * Handler eligibility is determined by:
   * - If no handlers config provided - all handlers are enabled
   * - If include list provided - only listed handlers are enabled
   * - If exclude list provided - all handlers except listed are enabled
   */
  private buildAccountLookup(): void {
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

  async processEvent({ eventRecord, blockNumber }: EventHandlerParams): Promise<void> {
    const { event } = eventRecord;
    const eventName = `${event.section}.${event.method}`;
    const handler = this.eventHandlers.get(eventName);
    if (handler) {
      await handler({ eventRecord, blockNumber });
    }
  }

  async processCall({ call, origin, blockNumber, extrinsicIndex }: CallHandlerParams): Promise<void> {
    const callName = `${call.section}.${call.method}`;
    const handler = this.callHandlers.get(callName);
    if (handler) {
      await handler({ call, origin, blockNumber, extrinsicIndex });
    }
  }

  async processEveryBlock({ blockNumber }: EveryBlockHandlerParams): Promise<void> {
    for (const handler of this.everyBlockHandlers) {
      await handler({ blockNumber });
    }
  }

  protected getEventLink(blockNumber: number, phase: Phase): string {
    if (!phase.isApplyExtrinsic) {
      this.logger.warn(`Unable to generate event link: Phase is not ApplyExtrinsic in block ${blockNumber}`);
      return '';
    }
    const index = phase.asApplyExtrinsic.toNumber();
    return `https://${this.chainProps.specName}.subscan.io/event?extrinsic=${blockNumber}-${index}`;
  }

  protected getAccountLink(address: string): string {
    return `https://${this.chainProps.specName}.subscan.io/account/${address}`;
  }

  protected getExtrinsicLink(blockNumber: number, extrinsicIndex: number): string {
    return `https://${this.chainProps.specName}.subscan.io/extrinsic/${blockNumber}-${extrinsicIndex}`;
  }

  protected formatLink(title: string, url: string): string {
    return `[${title}](${url})`;
  }

  protected formatAccountLink(account: AccountId): string {
    return this.formatLink(account.name, this.getAccountLink(account.ss58));
  }

  protected createMessage(
    rows: string[],
    options?: {
      blockNumber: number;
      phase?: Phase;
      extrinsicIndex?: number;
      address?: string;
    },
  ): Message {
    if (options) {
      // TODO: Refactor this. Decrement by two since IncidentHandler.THRESHOLD = 3
      const block = options.blockNumber - 2
      rows.push(`Block: ${block}`);
      if (options.phase !== undefined) {
        rows.push(`Event: ${this.getEventLink(options.blockNumber, options.phase)}`);
      } else if (options.extrinsicIndex !== undefined) {
        rows.push(`Extrinsic: ${this.getExtrinsicLink(options.blockNumber, options.extrinsicIndex)}`);
      }
    }
    rows.push(`Network: ${this.chainProps.chain}`);
    return { title: rows.shift(), details: rows };
  }

  protected formatBalance(amount: number | string | bigint): string {
    return formatBalance(amount, {
      decimals: this.chainProps.chainDecimals,
      withUnit: this.chainProps.chainToken,
      withSi: true,
      forceUnit: '-',
    });
  }
}
