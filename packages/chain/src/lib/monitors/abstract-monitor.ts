import {
  CallHandlerFunction,
  ChainDataProvider,
  Monitor,
  ChainProperties,
  ComparisonType,
  EventHandlerFunction,
  IncidentHandlerClient,
  Logger,
  MonitoringGroup,
  MonitorType,
  StateHandlerFunction,
  CallHandlerParams,
  EventHandlerParams,
  StateHandlerParams,
} from '@w3f/monitoring-types';
import { Formatter } from '../formatter';
import { AccountRegistry } from '../account-registry';

/**
 * Base class for all chain monitors in the monitoring platform.
 * Provides common infrastructure for handler management and chain-specific processing.
 *
 * Chain monitors use three types of handlers:
 * 1. Event handlers - triggered by specific chain events
 * 2. Call handlers - triggered by specific extrinsic calls
 * 3. State handlers - executed periodically on every block
 *
 * @typeParam T - Type of monitor (e.g., Staking, Identity, Governance)
 */
export abstract class AbstractMonitor<T extends MonitorType> implements Monitor {
  protected handlers = {
    event: new Map<string, EventHandlerFunction>(),
    call: new Map<string, CallHandlerFunction>(),
    state: new Set<StateHandlerFunction>(),
  };

  protected fmt: Formatter;
  protected reg: AccountRegistry<T>;

  // TODO: This will be moved to a ValueProcessor
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

  constructor(
    protected logger: Logger,
    protected groups: MonitoringGroup[],
    protected incidents: IncidentHandlerClient,
    protected chainProps: ChainProperties,
    protected chain: ChainDataProvider,
    protected monitorType: T,
  ) {
    this.fmt = new Formatter(this.chainProps);
    this.reg = new AccountRegistry<T>(groups, monitorType);
    this.initializeHandlers();
  }

  /**
   * Initializes all handlers for the monitor.
   *
   * For each handler type:
   * 1. Binds handler methods to the instance
   * 2. Stores handlers in the appropriate collection
   * 3. Only includes handlers that are supported for the current chain
   */
  private initializeHandlers(): void {
    const prototype = Object.getPrototypeOf(this);

    // Process event and call handlers (Map-based)
    for (const type of ['event', 'call']) {
      for (const [key, metadata] of prototype[type]) {
        if (typeof this[metadata.method] === 'function' && metadata.chains.includes(this.chainProps.chain)) {
          const handler = this[metadata.method].bind(this);
          this.handlers[type].set(key, handler);
        }
      }
    }

    // Process state handlers (Set-based)
    for (const [_, metadata] of prototype.state) {
      if (typeof this[metadata.method] === 'function' && metadata.chains.includes(this.chainProps.chain)) {
        const handler = this[metadata.method].bind(this);
        this.handlers.state.add(handler);
      }
    }
  }

  async processEvent({ eventRecord, blockNumber }: EventHandlerParams): Promise<void> {
    const { event } = eventRecord;
    const eventName = `${event.section}.${event.method}`;
    const handler = this.handlers.event.get(eventName);

    if (handler) {
      await handler.call(this, { eventRecord, blockNumber });
    }
  }

  async processCall({ call, origin, blockNumber, extrinsicIndex }: CallHandlerParams): Promise<void> {
    const callName = `${call.section}.${call.method}`;
    const handler = this.handlers.call.get(callName);

    if (handler) {
      await handler.call(this, { call, origin, blockNumber, extrinsicIndex });
    }
  }

  async processState(params: StateHandlerParams): Promise<void> {
    for (const handler of this.handlers.state) {
      await handler.call(this, params);
    }
  }
}
