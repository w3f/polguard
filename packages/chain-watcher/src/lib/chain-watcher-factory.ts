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
  const { logger, api, chain, storageClient, eventEmitterClient, metricsClient } = dependencies;

  const chainProperties: ChainProperties = await getChainProperties(api);
  if (chain !== chainProperties.chain) {
    throw new Error(
      `Chain mismatch: Config chain is "${chain}" but RPC endpoint returns "${chainProperties.chain}". Please check your configuration.`,
    );
  }
  const store = ChainWatcherStore.getInstance(storageClient, chain, logger);
  const stateQueryProvider = createApiStateQueryProvider(api, store);
  const incidentHandler = new IncidentHandler(logger, store, eventEmitterClient, chain);

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
  chain: Chain;
}

async function getChainProperties(api: ApiPromise): Promise<ChainProperties> {
  const [chainProperties, chainDecimals, chainTokens] = await Promise.all([
    api.rpc.system.properties(),
    api.registry.chainDecimals,
    api.registry.chainTokens,
  ]);

  const specName = api.runtimeVersion.specName.toString();
  const chain = specNameToChain(specName);

  return {
    chain,
    specName,
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
