import {
  ChainProperties,
  Logger,
  KeyValueStorageClient,
  EventEmitterClient,
  MetricsClient,
  MonitoringGroup,
  MonitorType,
  TelemetryClient,
  MonitorConstructor,
  TelemetryMonitor,
  NoProvider,
} from '@w3f/monitoring-types';
import { Store } from '../common/store';
import { IncidentHandler } from '../common/incident-handler';
import { TelemetryMonitor as TelemetryMonitorImpl } from './monitors/telemetry-monitor';
import { TelemetryWatcher } from './telemetry-watcher';

export async function createTelemetryWatcher(
  groups: MonitoringGroup[],
  dependencies: TelemetryWatcherDependencies,
): Promise<TelemetryWatcher> {
  const { logger, chainProps, storageClient, eventEmitterClient, metricsClient, telemetryClient } = dependencies;

  const store = new Store(storageClient, chainProps.chain, logger);
  const incidentHandler = new IncidentHandler(logger, store, eventEmitterClient, chainProps.chain);

  const monitorConfigs: [MonitorType, MonitorConstructor<MonitorType, TelemetryMonitor<MonitorType>, NoProvider>][] = [
    [MonitorType.Telemetry, TelemetryMonitorImpl],
  ];

  return new TelemetryWatcher(
    logger,
    groups,
    incidentHandler,
    store,
    metricsClient,
    telemetryClient,
    chainProps,
    monitorConfigs,
  );
}

export interface TelemetryWatcherDependencies {
  logger: Logger;
  storageClient: KeyValueStorageClient;
  eventEmitterClient: EventEmitterClient;
  metricsClient: MetricsClient;
  telemetryClient: TelemetryClient;
  chainProps: ChainProperties;
}
