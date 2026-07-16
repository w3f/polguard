import { Chain } from '@w3f/polguard-common';
import type { PolkadotClient } from 'polkadot-api';
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
