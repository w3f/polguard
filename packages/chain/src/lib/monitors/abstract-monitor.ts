import {
  ChainProperties,
  Logger,
  MonitorType,
  CallHandlerFunction,
  ChainDataProvider,
  Monitor,
  EventHandlerFunction,
  IncidentHandlerClient,
  MonitoringGroup,
  StateHandlerFunction,
  CallHandlerParams,
  StateHandlerParams,
  SystemEvent,
  BlockContext,
} from '../../types';
import { Formatter } from '../formatter';
import { ConfigRegistry } from '../config-registry';

/**
 * Base class for all chain monitors in the monitoring polkadot.
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
    event: new Map<string, EventHandlerFunction[]>(),
    call: new Map<string, CallHandlerFunction[]>(),
    state: new Set<StateHandlerFunction>(),
  };

  protected fmt: Formatter;
  protected reg: ConfigRegistry<T>;

  constructor(
    protected logger: Logger,
    protected groups: MonitoringGroup[],
    protected incidents: IncidentHandlerClient,
    protected chainProps: ChainProperties,
    protected chain: ChainDataProvider,
    protected monitorType: T,
  ) {
    this.fmt = new Formatter(this.chainProps);
    this.reg = new ConfigRegistry<T>(groups, monitorType);
    this.initializeHandlers();
  }

  /**
   * Initializes all handlers for the monitor.
   *
   * For each handler type:
   * 1. Binds handler methods to the instance
   * 2. Stores handlers in the appropriate collection
   * 3. Only includes handlers that are supported for the current chain
   * 4. Only includes handlers that are specified in the monitoring groups
   */
  private initializeHandlers(): void {
    const prototype = Object.getPrototypeOf(this);
    // A set of handler types that are included in the monitoring groups
    const activeHandlers = new Set(
      this.groups
        .flatMap(group => group.monitors)
        .filter(monitor => monitor.name === this.monitorType && monitor.settings.handlers)
        .flatMap(monitor => monitor.settings.handlers as string[]),
    );

    // Process event and call handlers (Map-based)
    for (const type of ['event', 'call']) {
      if (prototype[type]) {
        for (const [key, metadataArray] of prototype[type]) {
          const handlers = [];
          for (const metadata of metadataArray) {
            if (
              typeof this[metadata.method] === 'function' &&
              metadata.chains.includes(this.chainProps.chain) &&
              activeHandlers.has(metadata.handler)
            ) {
              // Bind the handler method to this instance
              const boundHandler = this[metadata.method].bind(this);
              handlers.push(boundHandler);
            }
          }

          // Only set handlers if we found at least one valid handler
          if (handlers.length > 0) {
            this.handlers[type].set(key, handlers);
          }
        }
      }
    }

    // Process state handlers (Set-based)
    if (prototype.state) {
      for (const [_, metadata] of prototype.state) {
        if (
          typeof this[metadata.method] === 'function' &&
          metadata.chains.includes(this.chainProps.chain) &&
          activeHandlers.has(metadata.handler)
        ) {
          const handler = this[metadata.method].bind(this);
          this.handlers.state.add(handler);
        }
      }
    }
  }

  async processEvent(systemEvent: SystemEvent, blockContext: BlockContext): Promise<void> {
    const { event } = systemEvent;
    const pallet = event.type.toLowerCase();
    const eventType = event.value.type;
    const eventName = `${pallet}.${eventType}`;
    const handlers = this.handlers.event.get(eventName);

    if (handlers && handlers.length > 0) {
      const payload = event.value.value;
      for (const handler of handlers) {
        await handler.call(this, { payload, blockContext });
      }
    }
  }

  async processCall({ call, origin, blockContext }: CallHandlerParams): Promise<void> {
    const callName = `${call.type}.${call.value.type}`;
    const handlers = this.handlers.call.get(callName);

    if (handlers && handlers.length > 0) {
      for (const handler of handlers) {
        await handler.call(this, { call, origin, blockContext });
      }
    }
  }

  async processState(params: StateHandlerParams): Promise<void> {
    for (const handler of this.handlers.state) {
      await handler.call(this, params);
    }
  }
}
