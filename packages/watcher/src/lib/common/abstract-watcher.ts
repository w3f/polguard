import {
  Logger,
  MetricsClient,
  IncidentHandlerClient,
  KeyValueStorageClient,
  MonitoringGroup,
  ChainProperties,
  Monitor,
  MonitorType,
  MonitorConstructor,
  DataProvider,
} from '@w3f/monitoring-types';

/**
 * Base class for all watchers in the monitoring platform.
 * Provides common infrastructure for metrics, monitor initialization, and lifecycle management.
 *
 * @typeParam T - Type of monitors this watcher manages (e.g., Staking, Identity)
 * @typeParam M - Specific monitor implementation (e.g., ChainMonitor, TelemetryMonitor)
 * @typeParam D - Type of data provider used by the watcher and its monitors
 *
 * Key responsibilities:
 * 1. Monitor Management
 *    - Initializes configured monitors
 *    - Maintains monitor instances
 *    - Tracks monitoring metrics
 *
 * 2. Lifecycle Management
 *    - Controls watcher's running state
 *    - Handles startup and shutdown
 */
export abstract class AbstractWatcher<T extends MonitorType, M extends Monitor<T>, D extends DataProvider> {
  protected monitors: M[] = [];
  protected isRunning = false;

  constructor(
    protected logger: Logger,
    protected monitoringGroups: MonitoringGroup[],
    protected incidents: IncidentHandlerClient,
    protected store: KeyValueStorageClient,
    protected metrics: MetricsClient,
    protected chainProps: ChainProperties,
    protected provider: D,
    protected monitorConfigs: [T, MonitorConstructor<T, M, D>][],
  ) {
    this.initializeMonitors();
  }

  /**
   * Initializes monitors based on the provided configurations.
   * For each monitor type:
   * 1. Filters relevant monitoring groups
   * 2. Creates monitor instance if there are matching groups
   * 3. Tracks total accounts and groups for metrics
   */
  protected initializeMonitors(): void {
    this.logger.debug(`Initializing monitors for ${this.constructor.name}`);

    let totalAccounts = 0;
    let totalGroups = 0;

    this.logger.debug(
      `Monitor configs: ${this.monitorConfigs.map(([type, ctor]) => `${type}: ${ctor.name}`).join(', ')}`,
    );

    this.monitors = this.monitorConfigs.flatMap(([monitorType, MonitorClass]) => {
      const groups = this.monitoringGroups.filter(
        group => group.chain === this.chainProps.chain && group.monitors.some(monitor => monitor.name === monitorType),
      );

      this.logger.debug(`Found ${groups.length} groups for monitor type ${monitorType}`);

      if (groups.length > 0) {
        const monitorAccounts = groups.reduce((acc, group) => acc + (group.accounts?.length || 0), 0);

        totalGroups += groups.length;
        totalAccounts += monitorAccounts;

        this.logger.debug(`Creating monitor ${MonitorClass.name} with ${monitorAccounts} accounts`);

        return [new MonitorClass(this.logger, groups, this.incidents, this.chainProps, this.provider, monitorType)];
      }
      return [];
    });

    this.logger.debug(`Initialized ${this.monitors.length} monitors`);
    this.logger.debug(`Total accounts: ${totalAccounts}, total groups: ${totalGroups}`);

    this.initializeMetrics(totalAccounts, totalGroups);
  }

  /**
   * Updates metrics with the current monitoring state
   * @param totalAccounts - Total number of accounts being monitored
   * @param totalGroups - Total number of monitoring groups
   */
  protected initializeMetrics(totalAccounts: number, totalGroups: number): void {
    this.metrics.setMonitoredAccountsCount(totalAccounts);
    this.metrics.setMonitorGroupsCount(totalGroups);
    this.metrics.setMonitorsCount(this.monitors.length);
  }

  /**
   * Starts the watcher if it's not already running.
   * Initializes watcher-specific watching mechanism through startWatching
   * @param params Watcher-specific initialization parameters
   */
  async start(params?: unknown): Promise<void> {
    if (this.isRunning) {
      this.logger.debug(`${this.constructor.name} has already been started.`);
      return;
    }
    this.isRunning = true;
    await this.startWatching(params);
  }

  /**
   * Stops the watcher if it's running.
   * Cleans up watcher-specific resources through stopWatching
   */
  async stop(): Promise<void> {
    this.isRunning = false;
    await this.stopWatching();
  }

  /**
   * Initializes and starts the watcher-specific watching mechanism
   * Examples:
   * - Chain watcher subscribes to new blocks with WS
   * - Telemetry watcher starts polling the telemetry API
   */
  protected abstract startWatching(params?: unknown): Promise<void>;

  /**
   * Cleans up watcher-specific resources, usually API connections
   */
  protected abstract stopWatching(): Promise<void>;
}
