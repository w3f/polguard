import {
  ChainProperties,
  AppLogger,
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
  MonitorHandlerType,
  MonitorSettings,
  IncidentContent,
  IncidentKey,
  balance,
  accountRef,
} from '../../types';
import { ConfigRegistry, AccountConfig } from '../config-registry';

type Row = string | false | null | undefined;

/**
 * A watched account bound to the current handler invocation. Hides the mechanical
 * plumbing (subject/key/handlerType/block/dispatch) so handlers read as
 * "for each account, report/track this condition".
 */
export interface BoundAccount<T extends MonitorType> {
  readonly ss58: string;
  readonly name: string;
  readonly settings: MonitorSettings<T>;
  /** One-time incident (created already-resolved). */
  report(condition: string, details: Row[], token?: string): Promise<void>;
  /** Ongoing incident whose create/resolve lifecycle is driven by `isFiring`. */
  track(condition: string, details: Row[], isFiring: boolean, token?: string): Promise<void>;
}

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

  protected reg: ConfigRegistry<T>;

  // Ambient per-invocation context, stashed by the decorator wrapper (`bindContext`) before
  // each handler runs. Safe because handlers never run concurrently within a single monitor
  // instance: ChainWatcher.processBlock awaits state, then events, then calls in order, and
  // AbstractMonitor iterates each in awaited `for` loops. If handlers are ever parallelized
  // within one instance, this would race and must become an explicit per-call context.
  private _ctx?: { handlerType: MonitorHandlerType[T]; block: BlockContext };

  constructor(
    protected logger: AppLogger,
    protected groups: MonitoringGroup[],
    protected incidents: IncidentHandlerClient,
    protected chainProps: ChainProperties,
    protected chain: ChainDataProvider,
    protected monitorType: T,
  ) {
    this.reg = new ConfigRegistry<T>(groups, monitorType);
    this.initializeHandlers();
  }

  /** Called by the handler decorators before each invocation. */
  bindContext(handlerType: MonitorHandlerType[T], block: BlockContext): void {
    this._ctx = { handlerType, block };
  }

  protected get block(): BlockContext {
    return this._ctx!.block;
  }

  protected get handlerType(): MonitorHandlerType[T] {
    return this._ctx!.handlerType;
  }

  protected balance(amount: number | string | bigint, token?: string): string {
    return balance(this.chainProps.chain, amount, token);
  }

  /** Chain-free account marker; the renderer resolves it to a real explorer link. */
  protected accountRef(address: string, name?: string): string {
    return accountRef(address, name);
  }

  /** Watched accounts matching a specific address, eligible for the current handler. */
  protected *matched(address: string): Iterable<BoundAccount<T>> {
    for (const cfg of this.reg.getAccounts(this.handlerType, address)) yield this.bound(cfg);
  }

  /** Every watched account eligible for the current handler. */
  protected *watched(): Iterable<BoundAccount<T>> {
    for (const address of this.reg.getUniqueAddresses())
      for (const cfg of this.reg.getAccounts(this.handlerType, address)) yield this.bound(cfg);
  }

  private bound(cfg: AccountConfig<T>): BoundAccount<T> {
    const { account } = cfg;
    return {
      ss58: account.ss58,
      name: account.name,
      settings: account.settings,
      report: (condition, details, token) => this.emit(cfg, condition, details, undefined, token),
      track: (condition, details, isFiring, token) => this.emit(cfg, condition, details, isFiring, token),
    };
  }

  private emit(cfg: AccountConfig<T>, condition: string, details: Row[], isFiring?: boolean, token?: string): Promise<void> {
    const { account, notifications, groupId } = cfg;
    const content: IncidentContent = {
      subject: { name: account.name, address: account.ss58 },
      condition,
      details: details.filter(Boolean) as string[], // pure facts; the renderer appends the footer
    };
    const key: IncidentKey = { account: account.ss58, groupId, handlerType: this.handlerType, token };
    return this.incidents.handle(content, notifications, key, this.block, isFiring);
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
