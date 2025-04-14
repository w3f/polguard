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
  MonitoringConfigClient,
} from '@w3f/monitoring-types';

/**
 * Base class for all watchers in the monitoring platform.
 * Provides common infrastructure for monitor initialization and lifecycle management.
 *
 * @typeParam T - Type of monitors this watcher manages (e.g., Staking, Identity)
 * @typeParam M - Specific monitor implementation (e.g., ChainMonitor, TelemetryMonitor)
 * @typeParam D - Type of data provider used by the watcher and its monitors
 *
 * Key responsibilities:
 * 1. Monitor Management
 *    - Initializes configured monitors
 *    - Maintains monitor instances
 *
 * 2. Lifecycle Management
 *    - Controls watcher's running state
 *    - Handles startup and shutdown
 */
export abstract class AbstractWatcher<T extends MonitorType, M extends Monitor<T>, D extends DataProvider> {
  protected monitors: M[] = [];
  protected isRunning = false;
  protected readonly configRefreshIntervalMs = 15 * 60 * 1000; // 15 minutes

  constructor(
    protected logger: Logger,
    protected monitoringConfigClient: MonitoringConfigClient,
    protected incidents: IncidentHandlerClient,
    protected store: KeyValueStorageClient,
    protected metrics: MetricsClient,
    protected chainProps: ChainProperties,
    protected provider: D,
    protected monitorConfigs: [T, MonitorConstructor<T, M, D>][],
  ) {}

  /**
   * Initializes monitors based on the latest configuration.
   * For each monitor type:
   * 1. Fetches the latest monitoring groups from the client
   * 2. Filters relevant monitoring groups
   * 3. Creates monitor instance if there are matching groups
   */
  protected async initializeMonitors(throwError: boolean = true): Promise<void> {
    // Fetch the latest monitoring groups

    let groups: MonitoringGroup[];
    try {
      groups = await this.monitoringConfigClient.getMonitoringGroups();
    } catch (error) {
      this.logger.error(`Failed to fetch monitoring groups: ${error.message}`);
      if (throwError) {
        throw new Error(`Failed to fetch monitoring groups: ${error.message}`);
      }
      return;
    }

    // Clear existing monitors
    this.monitors = [];

    // Create new monitors based on the latest configuration
    this.monitors = this.monitorConfigs.flatMap(([monitorType, MonitorClass]) => {
      const filteredGroups = groups.filter(
        group => group.chain === this.chainProps.chain && group.monitors.some(monitor => monitor.name === monitorType),
      );

      if (filteredGroups.length > 0) {
        return [
          new MonitorClass(this.logger, filteredGroups, this.incidents, this.chainProps, this.provider, monitorType),
        ];
      }
      return [];
    });

    this.logger.debug(`Initialized ${this.monitors.length} monitors for chain ${this.chainProps.chain}`);
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

    // Load initial monitoring groups
    await this.initializeMonitors();

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
