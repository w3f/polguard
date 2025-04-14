import { ApiPromise } from '@polkadot/api';
import { ChainWatcher } from './chain-watcher';
import { createChainDataProvider } from './chain-data-provider';
import {
  ChainProperties,
  Logger,
  KeyValueStorageClient,
  IncidentApiClient,
  MetricsClient,
  MonitorType,
  ChainDataProvider,
  MonitorConstructor,
  ChainMonitor,
  MonitoringConfigClient,
} from '@w3f/monitoring-types';
import { Store } from '../common/store';
import { IncidentHandler } from '../common/incident-handler';
import { BalancesMonitor, GovernanceMonitor, StakingMonitor, XcmMonitor } from './monitors';
import { IdentityMonitor } from './monitors/identity/identity-monitor';

export async function createChainWatcher(dependencies: ChainWatcherDependencies): Promise<ChainWatcher> {
  const { logger, api, chainProps, storageClient, incidentApiClient, metricsClient, monitoringConfigClient } =
    dependencies;

  const specName = api.runtimeVersion.specName.toString();
  if (specName !== chainProps.specName) {
    throw new Error(
      `Chain mismatch: Config chain is "${chainProps.specName}" but RPC endpoint returns "${specName}". Please check your configuration.`,
    );
  }

  const store = new Store(storageClient, chainProps.chain);
  const chainDataProvider = createChainDataProvider(api, store, logger);
  const incidentHandler = new IncidentHandler(logger, store, incidentApiClient, chainProps.chain);

  const monitorConfigs: [MonitorType, MonitorConstructor<MonitorType, ChainMonitor<MonitorType>, ChainDataProvider>][] =
    [
      [MonitorType.Governance, GovernanceMonitor],
      [MonitorType.Staking, StakingMonitor],
      [MonitorType.Balances, BalancesMonitor],
      [MonitorType.Identity, IdentityMonitor],
      [MonitorType.Xcm, XcmMonitor],
    ];

  return new ChainWatcher(
    logger,
    monitoringConfigClient,
    api,
    incidentHandler,
    store,
    metricsClient,
    chainDataProvider,
    chainProps,
    monitorConfigs,
  );
}

export interface ChainWatcherDependencies {
  logger: Logger;
  api: ApiPromise;
  storageClient: KeyValueStorageClient;
  incidentApiClient: IncidentApiClient;
  metricsClient: MetricsClient;
  chainProps: ChainProperties;
  monitoringConfigClient: MonitoringConfigClient;
}
