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
} from './interfaces';
import { ChainWatcherStore } from './store/chain-watcher-store';
import { IncidentHandler } from './incident/incident-handler';
import { Chain } from './constants';

export async function createChainWatcher(
  groups: MonitoringGroup[],
  dependencies: ChainWatcherDependencies,
): Promise<ChainWatcher> {
  const { logger, api, storageClient, eventEmitterClient, metricsClient } = dependencies;

  const chainProperties: ChainProperties = await getChainProperties(api);
  const chain: Chain = specNameToChain(chainProperties.specName);

  const store = ChainWatcherStore.getInstance(storageClient, logger);
  const incidentHandler = new IncidentHandler(logger, store, eventEmitterClient, chain);
  const stateQueryProvider = createApiStateQueryProvider(api, store);

  return new ChainWatcher(
    logger,
    groups,
    api,
    incidentHandler,
    store,
    metricsClient,
    stateQueryProvider,
    chainProperties,
  );
}

export interface ChainWatcherDependencies {
  logger: Logger;
  api: ApiPromise;
  storageClient: KeyValueStorageClient;
  eventEmitterClient: EventEmitterClient;
  metricsClient: MetricsClient;
}

async function getChainProperties(api: ApiPromise): Promise<ChainProperties> {
  const [chainProperties, chainDecimals, chainTokens] = await Promise.all([
    api.rpc.system.properties(),
    api.registry.chainDecimals,
    api.registry.chainTokens,
  ]);

  return {
    specName: api.runtimeVersion.specName.toString(),
    chainDecimals: chainDecimals[0],
    chainToken: chainTokens[0],
    ss58Format: chainProperties.ss58Format.unwrapOr(42) as number,
  };
}

function specNameToChain(specName: string): Chain {
  switch (specName.toLowerCase()) {
    case 'polkadot':
      return Chain.Polkadot;
    case 'kusama':
      return Chain.Kusama;
    default:
      throw new Error(`Unsupported chain: ${specName}`);
  }
}
