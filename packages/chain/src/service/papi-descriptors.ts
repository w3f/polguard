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
 * Gets the typed API for a specific chain
 */
export function getTypedApi(client: PolkadotClient, chain: Chain) {
  const descriptor = CHAIN_DESCRIPTORS[chain];
  if (!descriptor) {
    throw new Error(`No PAPI descriptor found for chain: ${chain}`);
  }
  return client.getTypedApi(descriptor);
}
