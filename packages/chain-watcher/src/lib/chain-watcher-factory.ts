import { ApiPromise } from '@polkadot/api';
import { ChainWatcher } from './chain-watcher';
import { createApiStateQueryProvider } from './providers/state-provider';
import {
  ChainProperties,
  Logger,
  KeyValueStorageClient,
  EventEmitterClient,
  MetricsClient,
  MonitoringGroup,
  Chain,
} from '@w3f/monitoring-types';
import { ChainWatcherStore } from './store/chain-watcher-store';
import { IncidentHandler } from './incident/incident-handler';

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
  const store = ChainWatcherStore.getInstance(storageClient, chainProps.chain, logger);
  const stateQueryProvider = createApiStateQueryProvider(api, store, logger);
  const incidentHandler = new IncidentHandler(logger, store, eventEmitterClient, chainProps.chain);

  return new ChainWatcher(logger, groups, api, incidentHandler, store, metricsClient, stateQueryProvider, chainProps);
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
