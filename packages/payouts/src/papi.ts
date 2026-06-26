import { Chain } from '@w3f/polguard-common';
import { assetHubPolkadot, assetHubKusama } from '@polkadot-api/descriptors';
import { createClient, type PolkadotClient, type TypedApi } from 'polkadot-api';
import { getWsProvider } from 'polkadot-api/ws';
import { sr25519CreateDerive } from '@polkadot-labs/hdkd';
import { entropyToMiniSecret, mnemonicToEntropy } from '@polkadot-labs/hdkd-helpers';
import { getPolkadotSigner, type PolkadotSigner } from 'polkadot-api/signer';

export type PayoutApi = TypedApi<typeof assetHubPolkadot> | TypedApi<typeof assetHubKusama>;

export function createChainClient(rpcUrl: string): PolkadotClient {
  return createClient(getWsProvider(rpcUrl));
}

export function getPayoutApi(client: PolkadotClient, chain: Chain): PayoutApi {
  switch (chain) {
    case Chain.AssetHubPolkadot:
      return client.getTypedApi(assetHubPolkadot);
    case Chain.AssetHubKusama:
      return client.getTypedApi(assetHubKusama);
    default:
      throw new Error(`No payout descriptor for chain: ${chain}`);
  }
}

export function signerFromMnemonic(mnemonic: string): PolkadotSigner {
  const miniSecret = entropyToMiniSecret(mnemonicToEntropy(mnemonic));
  const keypair = sr25519CreateDerive(miniSecret)('');
  return getPolkadotSigner(keypair.publicKey, 'Sr25519', keypair.sign);
}
