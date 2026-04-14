import { Chain } from '@w3f/polguard-common';

export type TokenBalances = Record<string, Record<string, bigint>>;

export const CHAIN_TOKENS: Record<Chain, Record<string, { id: string; decimals: number }>> = {
  [Chain.AssetHubPolkadot]: {
    USDC: { id: '1337', decimals: 6 },
    USDT: { id: '1984', decimals: 6 },
  },
  [Chain.AssetHubKusama]: {
    USDT: { id: '1984', decimals: 6 },
  },
  [Chain.AssetHubPaseo]: {},
  [Chain.Polkadot]: {},
  [Chain.Kusama]: {},
  [Chain.Paseo]: {},
  [Chain.PeoplePolkadot]: {},
  [Chain.PeopleKusama]: {},
  [Chain.PeoplePaseo]: {},
  [Chain.Centrifuge]: {
    localUSDC: { id: '{"localAsset":1}', decimals: 6 },
  },
  [Chain.Frequency]: {},
};

export const ID_TOKEN_MAP: Record<Chain, Record<string, string>> = Object.fromEntries(
  Object.entries(CHAIN_TOKENS).map(([chain, tokenMetas]) => [
    chain,
    Object.fromEntries(Object.entries(tokenMetas).map(([symbol, { id }]) => [id, symbol])),
  ]),
) as Record<Chain, Record<string, string>>;
