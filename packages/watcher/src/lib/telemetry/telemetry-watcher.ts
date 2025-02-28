import {
  Logger,
  MonitoringGroup,
  IncidentHandlerClient,
  DataStoreClient,
  MetricsClient,
  ChainProperties,
  MonitorType,
  MonitorConstructor,
  TelemetryClient,
  TelemetryMonitor,
  NoProvider,
  NodeInfo,
  TelemetryData,
  AlertFiringThresholds,
} from '@w3f/monitoring-types';
import { AbstractWatcher } from '../common/abstract-watcher';

/**
 * TelemetryWatcher is responsible for monitoring node telemetry data and coordinating monitors.
 * It polls telemetry data at specified intervals and distributes it to appropriate monitors.
 *
 * Key responsibilities:
 * 1. Telemetry Processing
 *    - Polls telemetry data at configured intervals
 *    - Pre-processes telemetry data to organize by stash address
 *    - Processes telemetry data sequentially
 *
 * 2. Monitor Coordination
 *    - Executes periodic checks on telemetry data
 *    - Distributes telemetry data to relevant monitors
 */
export class TelemetryWatcher extends AbstractWatcher<MonitorType, TelemetryMonitor<MonitorType>, NoProvider> {
  constructor(
    logger: Logger,
    monitoringGroups: MonitoringGroup[],
    incidents: IncidentHandlerClient,
    store: DataStoreClient,
    metrics: MetricsClient,
    private telemetryClient: TelemetryClient,
    chainProps: ChainProperties,
    monitorConfigs: [MonitorType, MonitorConstructor<MonitorType, TelemetryMonitor<MonitorType>, NoProvider>][],
    private readonly interval: number,
    firingThresholds?: AlertFiringThresholds,
  ) {
    super(logger, monitoringGroups, incidents, store, metrics, chainProps, {} as NoProvider, monitorConfigs, firingThresholds);
    this.logger.debug(`Telemetry polling interval: ${interval}ms`);
  }

  protected async startWatching(): Promise<void> {
    if (this.monitors.length === 0) {
      throw new Error('No monitors were initialized for TelemetryWatcher.');
    }

    this.runTelemetryProcessing();
  }

  protected async stopWatching(): Promise<void> {
    // No cleanup needed
  }

  private async runTelemetryProcessing(): Promise<void> {
    while (this.isRunning) {
      await this.processTelemetry();
      await new Promise(resolve => setTimeout(resolve, this.interval));
    }
  }

  private async processTelemetry(): Promise<void> {
    try {
      const rawData = await this.telemetryClient.getTelemetry();
      this.logger.debug(
        `Received telemetry data for ${rawData[this.chainProps.specName]?.length || 0} ${this.chainProps.specName} nodes`,
      );

      const processedData = this.preprocessTelemetryData(rawData);

      for (const monitor of this.monitors) {
        await monitor.processTelemetry({ data: processedData });
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
