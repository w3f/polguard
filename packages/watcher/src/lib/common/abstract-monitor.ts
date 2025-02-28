import {
  AccountSettings,
  AlertFiringThresholds,
  AlertSettings,
  ChainProperties,
  ComparisonType,
  ConfigAccountSettings,
  DataProvider,
  HandlerExecutionType,
  HandlerFunction,
  IncidentHandlerClient,
  Logger,
  MonitorHandlerType,
  MonitoringGroup,
  MonitorSettings,
  MonitorType,
} from '@w3f/monitoring-types';

type AccountConfig<T extends MonitorType> = {
  account: AccountSettings<T>;
  alerts: AlertSettings;
  groupId: string;
};

/**
 * Base class for all monitors in the monitoring platform.
 * Provides common infrastructure for handler management and account lookups.
 *
 * Monitors are responsible for:
 * 1. Managing different types of handlers (triggered or periodic)
 * 2. Maintaining account configurations and their monitoring settings
 * 3. Filtering accounts based on handler eligibility
 *
 * @typeParam T - Type of monitor (e.g., Staking, Identity, Telemetry)
 * @typeParam D - Type of data provider used by this monitor (optional)
 */
export abstract class AbstractMonitor<T extends MonitorType, D extends DataProvider = never> {
  /** Maps handler names to their execution collections (Map for triggered, Set for periodic) */
  protected handlers: Map<string, Map<string, HandlerFunction<any>> | Set<HandlerFunction<any>>> = new Map();

  /** Maps addresses to their configurations across different monitoring groups */
  protected accounts: Map<string, AccountConfig<T>[]> = new Map();

  /** List of unique addresses being monitored */
  protected uniqueAddresses: string[];

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
    protected provider: D,
    protected monitorType: T,
    protected readonly firingThresholds?: AlertFiringThresholds,
  ) {
    this.buildAccountLookup();
    this.initializeHandlers();
    this.uniqueAddresses = Array.from(this.accounts.keys());
  }

  /**
   * Initializes all handlers based on their execution types.
   * Uses getHandlerDefinitions to determine how each handler collection should be structured:
   * - 'triggered' handlers are stored in a Map for key-based lookup
   * - 'periodic' handlers are stored in a Set for iteration
   *
   * For each handler:
   * 1. Creates appropriate collection based on execution type
   * 2. Binds handler methods to the instance
   * 3. Stores handlers in the collection only if they're supported for the current chain
   */
  private initializeHandlers(): void {
    const prototype = Object.getPrototypeOf(this);

    for (const [handlerName, handlerMap] of Object.entries(this.getHandlerDefinitions())) {
      if (!(prototype[handlerName] instanceof Map)) continue;

      const collection =
        handlerMap.type === 'triggered' ? new Map<string, HandlerFunction<any>>() : new Set<HandlerFunction<any>>();

      for (const [key, metadata] of prototype[handlerName]) {
        if (typeof this[metadata.method] === 'function' && metadata.chains.includes(this.chainProps.chain)) {
          const handler = this[metadata.method].bind(this) as HandlerFunction<any>;
          if (handlerMap.type === 'triggered') {
            (collection as Map<string, HandlerFunction<any>>).set(key, handler);
          } else {
            (collection as Set<HandlerFunction<any>>).add(handler);
          }
        }
      }

      this.handlers.set(handlerName, collection);
    }
  }

  /**
   * Returns a mapping of handler collection names to their execution types.
   * This method defines how different handlers in a monitor should be executed:
   *
   * - 'triggered' handlers (like event or call handlers) are stored in a Map and
   *   executed only when a specific trigger occurs (e.g., specific blockchain event)
   *
   * - 'periodic' handlers (like block handlers) are stored in a Set and
   *   executed on every iteration regardless of specific triggers
   *
   * Example for chain monitor:
   * {
   *   eventHandlers: { type: 'triggered' },  // Execute on specific events
   *   callHandlers: { type: 'triggered' },   // Execute on specific calls
   *   blockHandlers: { type: 'periodic' }    // Execute on every block
   * }
   *
   * Example for telemetry monitor:
   * {
   *   telemetryHandlers: { type: 'periodic' }  // Execute on every telemetry fetch
   * }
   *
   * @returns Record mapping handler collection names to their execution types
   */
  protected abstract getHandlerDefinitions(): Record<string, { type: HandlerExecutionType }>;

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
   * Helper method to iterate through all accounts for a given handler type.
   * Simplifies common pattern of iterating through unique addresses and their accounts.
   *
   * @param handlerType - Type of handler to get accounts for
   * @param callback - Function to execute for each account
   */
  protected async forEachAccount(
    handlerType: MonitorHandlerType[T],
    callback: (params: { account: AccountSettings<T>; alerts: AlertSettings; groupId: string }) => Promise<void>,
  ): Promise<void> {
    for (const address of this.uniqueAddresses) {
      for (const accountInfo of this.getAccounts(handlerType, address)) {
        await callback(accountInfo);
      }
    }
  }

  /**
   * Builds account lookup structure for the monitor.
   *
   * This method processes all accounts from the monitoring groups and creates a lookup map
   * that maps ss58 addresses to arrays of account configurations. Multiple configurations
   * for the same address are possible when the same account is monitored by different groups
   * with different settings.
   *
   * Example:
   * {
   *   "5GrwvaEF...": [
   *     {
   *       account: { ss58: "5GrwvaEF...", name: "Alice", ... },
   *       alerts: { targets: ["room1"], ... },
   *       groupId: "validators-1"
   *     },
   *     {
   *       account: { ss58: "5GrwvaEF...", name: "Alice", ... },
   *       alerts: { targets: ["room2"], ... },
   *       groupId: "validators-2"
   *     }
   *   ]
   * }
   *
   * Using Map for O(1) address lookups.
   */
  private buildAccountLookup(): void {
    for (const group of this.groups) {
      for (const account of group.accounts as ConfigAccountSettings[]) {
        if (!this.accounts.has(account.ss58)) {
          this.accounts.set(account.ss58, []);
        }
        this.accounts.get(account.ss58).push({
          account: {
            ss58: account.ss58,
            hex: account.hex,
            name: account.name,
            settings: account[this.monitorType] as MonitorSettings<T>,
          },
          alerts: group.alerts,
          groupId: group.name,
        });
      }
    }
  }

  /**
   * Helper method to format a URL link with a title
   *
   * @param title - Text to display for the link
   * @param url - URL to link to
   * @returns Formatted link string
   */
  protected formatLink(title: string, url: string): string {
    return `[${title}](${url})`;
  }

  /**
   * Gets the firing threshold for a given sensitivity level.
   * Falls back to default values if thresholds are not configured.
   * 
   * @param sensitivity - The sensitivity level to get threshold for
   * @returns The number of consecutive failures required before firing
   */
  protected getFiringThreshold(sensitivity: keyof AlertFiringThresholds = 'sensitive'): number {
    return this.firingThresholds?.[sensitivity] ?? {
      tolerant: 60,   // High threshold for noisy conditions
      moderate: 5,    // Standard threshold for most conditions
      sensitive: 3,   // Low threshold for stable conditions
    }[sensitivity];
  }
}
