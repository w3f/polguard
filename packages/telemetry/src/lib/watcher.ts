import {
  Logger,
  IncidentHandlerClient,
  MonitoringGroup,
  ChainProperties,
  MonitoringConfigClient,
  TelemetryMonitor,
  TelemetryClient,
  MonitorType,
  TelemetryData,
  NodeInfo,
} from '@w3f/monitoring-types';
import { TelemetryMonitor as TelemetryMonitorImpl } from './monitors/telemetry-monitor';

export class TelemetryWatcher {
  private monitors: TelemetryMonitor[] = [];
  private isRunning = false;
  private readonly configRefreshIntervalMs = 15 * 60 * 1000; // 15 minutes

  constructor(
    private logger: Logger,
    private monitoringConfigClient: MonitoringConfigClient,
    private telemetryClient: TelemetryClient,
    private incidents: IncidentHandlerClient,
    private chainProps: ChainProperties,
    private readonly pollingIntervalMs: number,
  ) {}

  /**
   * Starts the watcher if it's not already running.
   * Initializes monitors, subscribes to finalized blocks, and begins block processing.
   *
   * @param startBlock Optional starting block number
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.debug(`ChainWatcher has already been started.`);
      return;
    }

    await this.initializeMonitors();
    this.isRunning = true;

    this.startTelemetryProcessingLoop();
  }

  /**
   * Stops the watcher if it's running.
   * Sets running state to false and disconnects from the API.
   */
  async stop(): Promise<void> {
    this.isRunning = false;
  }

  /**
   * Initializes monitors based on the latest configuration.
   * For each monitor type:
   * 1. Fetches the latest monitoring groups from the client
   * 2. Filters relevant monitoring groups
   * 3. Creates monitor instance if there are matching groups
   *
   * @param throwError Whether to throw an error if fetching monitoring groups fails
   */
  private async initializeMonitors(throwError: boolean = true): Promise<void> {
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

    this.monitors = [];
    const telemetryGroups = groups.filter(
      group =>
        group.chain === this.chainProps.chain && group.monitors.some(monitor => monitor.name === MonitorType.Telemetry),
    );

    if (telemetryGroups.length > 0) {
      this.monitors = [
        new TelemetryMonitorImpl(this.logger, telemetryGroups, this.incidents, this.chainProps, MonitorType.Telemetry),
      ];
    }

    this.logger.debug(`Initialized ${this.monitors.length} monitors for chain ${this.chainProps.chain}`);
  }

  private async startTelemetryProcessingLoop(): Promise<void> {
    let lastConfigRefreshTime = Date.now();

    while (this.isRunning) {
      // Check if it's time to refresh config
      const now = Date.now();
      if (now - lastConfigRefreshTime >= this.configRefreshIntervalMs) {
        // Refresh monitors with latest configuration
        await this.initializeMonitors();
        lastConfigRefreshTime = now;
      }
      if (this.monitors.length === 0) {
        throw new Error('No monitors were initialized for TelemetryWatcher.');
      }
      await this.processTelemetry();
      await new Promise(resolve => setTimeout(resolve, this.pollingIntervalMs));
    }
  }

  private async processTelemetry(): Promise<void> {
    try {
      const rawData = await this.telemetryClient.getTelemetry();
      this.logger.debug(
        `Received telemetry data for ${rawData[this.chainProps.specName]?.length || 0} ${this.chainProps.specName} nodes`,
      );

      const data = this.preprocessTelemetryData(rawData);

      for (const monitor of this.monitors) {
        await monitor.processTelemetry({ data });
      }
    } catch (error) {
      this.logger.error('Error processing telemetry:', error);
    }
  }

  private preprocessTelemetryData(data: TelemetryData): Record<string, NodeInfo[]> {
    // Get nodes for the configured chain
    const chainKey = this.chainProps.specName.toLowerCase() as keyof TelemetryData;
    if (!(chainKey in data)) {
      throw new Error(`No telemetry data available for chain: ${this.chainProps.specName}`);
    }
    const nodes = data[chainKey] || [];

    // Group nodes by stash address for O(1) lookups
    return nodes.reduce((acc: Record<string, NodeInfo[]>, node: NodeInfo) => {
      if (node.config?.stash) {
        const stash = node.config.stash;
        if (!acc[stash]) {
          acc[stash] = [];
        }
        acc[stash].push(node);
      }
      return acc;
    }, {});
  }
}
