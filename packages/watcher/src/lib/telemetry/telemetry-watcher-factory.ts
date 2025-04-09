// TODO: The whole Telemetry feature is going to be removed in the future

import {
  ChainProperties,
  Logger,
  KeyValueStorageClient,
  IncidentApiClient,
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
  const { logger, chainProps, storageClient, incidentApiClient, metricsClient, telemetryClient, interval } =
    dependencies;

  const store = new Store(storageClient, chainProps.chain, logger);
  const incidentHandler = new IncidentHandler(logger, store, incidentApiClient, chainProps.chain);

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
    interval,
  );
}

export interface TelemetryWatcherDependencies {
  logger: Logger;
  storageClient: KeyValueStorageClient;
  incidentApiClient: IncidentApiClient;
  metricsClient: MetricsClient;
  telemetryClient: TelemetryClient;
  chainProps: ChainProperties;
  interval: number;
}
