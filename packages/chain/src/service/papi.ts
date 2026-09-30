import { Chain } from '@w3f/polguard-common';
import type { AppLogger } from '@w3f/polguard-common';
import { createClient } from 'polkadot-api';
import type { PolkadotClient } from 'polkadot-api';
import { getWsProvider, WsEvent } from 'polkadot-api/ws';
import {
  assetHubPolkadot,
  assetHubKusama,
  assetHubPaseo,
  peoplePolkadot,
  peopleKusama,
  peoplePaseo,
  frequency,
} from '@polkadot-api/descriptors';

/**
 * Mapping of Chain enum to PAPI descriptors
 * This allows us to get the typed API for each chain
 */
export const CHAIN_DESCRIPTORS = {
  [Chain.AssetHubPolkadot]: assetHubPolkadot,
  [Chain.AssetHubKusama]: assetHubKusama,
  [Chain.AssetHubPaseo]: assetHubPaseo,
  [Chain.PeoplePolkadot]: peoplePolkadot,
  [Chain.PeopleKusama]: peopleKusama,
  [Chain.PeoplePaseo]: peoplePaseo,
  [Chain.Frequency]: frequency,
} as const;

/**
 * Gets the runtime API for a specific chain.
 *
 * Uses the unsafe (descriptor-less) API on purpose: the watcher replays historical blocks across
 * runtime upgrades, and the typed API validates every decoded value against the bundled descriptors —
 * throwing `Incompatible runtime entry Storage(System.Events)` whenever an old block's runtime differs
 * from them (which the descriptors, pinned to one runtime, cannot represent). The unsafe API decodes
 * using each block's own runtime metadata instead, which is the correct behaviour for a block replayer.
 */
export function getTypedApi(client: PolkadotClient, chain: Chain) {
  const descriptor = CHAIN_DESCRIPTORS[chain];
  if (!descriptor) {
    throw new Error(`No PAPI descriptor found for chain: ${chain}`);
  }
  return client.getUnsafeApi<typeof descriptor>();
}

/**
 * Connects to the RPC and verifies it serves `chain`, by comparing genesis hashes.
 */
export async function connectChain(
  endpoints: string | string[],
  logger: AppLogger,
  chain: Chain,
): Promise<PolkadotClient> {
  const provider = getWsProvider(endpoints, {
    onStatusChanged: status => {
      const uri = 'uri' in status ? ` (${status.uri})` : '';
      const reason = status.type === WsEvent.ERROR && status.event?.type ? ` (${status.event.type})` : '';
      logger.info(`RPC status: ${status.type}${uri}${reason}`);
    },
  });
  const client = createClient(provider);
  const rpc = [endpoints].flat().join(', ');

  const expectedGenesis = CHAIN_DESCRIPTORS[chain]?.genesis;
  const { genesisHash } = await client.getChainSpecData();
  if (genesisHash !== expectedGenesis) {
    client.destroy();
    throw new Error(
      `RPC ${rpc} does not serve ${chain}: its genesis hash is ${genesisHash}, expected ${expectedGenesis}`,
    );
  }

  logger.info(`Connected to RPC: ${rpc}`);
  return client;
}
