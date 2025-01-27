import { ApiPromise } from '@polkadot/api';
import { ChainWatcher } from './chain-watcher';
import { createChainDataProvider } from './chain-data-provider';
import {
  ChainProperties,
  Logger,
  KeyValueStorageClient,
  EventEmitterClient,
  MetricsClient,
  MonitoringGroup,
  Chain,
  MonitorType,
  ChainDataProvider,
  MonitorConstructor,
  ChainMonitor,
} from '@w3f/monitoring-types';
import { Store } from '../common/store';
import { IncidentHandler } from '../common/incident-handler';
import { BalancesMonitor, GovernanceMonitor, StakingMonitor } from './monitors';
import { IdentityMonitor } from './monitors/identity/identity-monitor';

export async function createChainWatcher(
  groups: MonitoringGroup[],
  dependencies: ChainWatcherDependencies,
): Promise<ChainWatcher> {
  const { logger, api, chainProps, storageClient, eventEmitterClient, metricsClient } = dependencies;

  const specName = api.runtimeVersion.specName.toString();
  if (chainProps.chain !== specNameToChain(specName)) {
    throw new Error(
      `Chain mismatch: Config chain is "${chainProps.chain}" but RPC endpoint returns "${specName}". Please check your configuration.`,
    );
  }

  const store = new Store(storageClient, chainProps.chain, logger);
  const chainDataProvider = createChainDataProvider(api, store, logger);
  const incidentHandler = new IncidentHandler(logger, store, eventEmitterClient, chainProps.chain);

  const monitorConfigs: [MonitorType, MonitorConstructor<MonitorType, ChainMonitor<MonitorType>, ChainDataProvider>][] =
    [
      [MonitorType.Governance, GovernanceMonitor],
      [MonitorType.Staking, StakingMonitor],
      [MonitorType.Balances, BalancesMonitor],
      [MonitorType.Identity, IdentityMonitor],
    ];

  return new ChainWatcher(
    logger,
    groups,
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
  eventEmitterClient: EventEmitterClient;
  metricsClient: MetricsClient;
  chainProps: ChainProperties;
}

function specNameToChain(specName: string): Chain {
  switch (specName.toLowerCase()) {
    case 'polkadot':
      return Chain.Polkadot;
    case 'kusama':
      return Chain.Kusama;
    case 'people-polkadot':
      return Chain.PeoplePolkadot;
    case 'people-kusama':
      return Chain.PeopleKusama;
    default:
      throw new Error(`Unsupported chain: ${specName}`);
  }
}
