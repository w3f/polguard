export const TELEMETRY_PREFIX = 'polguard';

export interface ChainProperties {
  chain: Chain,
  displayName: string;
  specName: string;
  chainDecimals: number;
  chainToken: string;
  ss58Format: number;
  /**
   * Number of extra bytes after the common signed extensions (Era, Nonce, Tip)
   * that precede the call data in a signed extrinsic.
   */
  extrinsicExtraOffset: number;
}

export enum Chain {
  Polkadot = 'Polkadot',
  Kusama = 'Kusama',
  Paseo = 'Paseo',
  AssetHubPolkadot = 'AssetHubPolkadot',
  AssetHubKusama = 'AssetHubKusama',
  AssetHubPaseo = 'AssetHubPaseo',
  PeoplePolkadot = 'PeoplePolkadot',
  PeopleKusama = 'PeopleKusama',
  PeoplePaseo = 'PeoplePaseo',
  Centrifuge = 'Centrifuge',
  Frequency = 'Frequency',
}

export enum MonitorType {
  Balances = 'Balances',
  Identity = 'Identity',
  Staking = 'Staking',
  Governance = 'Governance',
  Xcm = 'Xcm',
  Assets = 'Assets',
}


export enum StakingHandlerType {
  OffenceReportedEvent = 'OffenceReportedEvent',
  CommissionChangedEvent = 'CommissionChangedEvent',
  UnbondedEvent = 'UnbondedEvent',
  DestinationChangedCall = 'DestinationChangedCall',
  DestinationChangedState = 'DestinationChangedState',
  CommissionUnexpectedState = 'CommissionUnexpectedState',
  DestinationUnexpectedState = 'DestinationUnexpectedState',
  SelfStakeUnexpectedState = 'SelfStakeUnexpectedState',
  ActiveSetPresenceState = 'ActiveSetPresenceState',
  ValidatorIntentionMissingState = 'ValidatorIntentionMissingState',
}

export enum BalancesHandlerType {
  BalanceDecreaseState = 'BalanceDecreaseState',
  BalanceThresholdState = 'BalanceThresholdState',
  TransferIngressEvent = 'TransferIngressEvent',
  TransferEgressEvent = 'TransferEgressEvent',
  TransferCall = 'TransferCall',
}

export enum IdentityHandlerType {
  IdentityUnexpectedState = 'IdentityUnexpectedState',
  IdentityChangedEvent = 'IdentityChangedEvent',
  IdentityMissingState = 'IdentityMissingState',
  IdentityFieldsMissingState = 'IdentityFieldsMissingState',
}

export enum GovernanceHandlerType {
  ReferendaSubmittedEvent = 'ReferendaSubmittedEvent',
  ConvictionVoteCall = 'ConvictionVoteCall',
}

export enum XcmHandlerType {
  XcmTransferEgressEvent = 'XcmTransferEgressEvent',
}

export enum AssetsHandlerType {
  AssetBalanceDecreaseState = 'AssetBalanceDecreaseState',
  AssetBalanceThresholdState = 'AssetBalanceThresholdState',
  AssetTransferIngressEvent = 'AssetTransferIngressEvent',
  AssetTransferEgressEvent = 'AssetTransferEgressEvent',
}

export const CHAIN_CONFIGS: Record<Chain, ChainProperties> = {
  [Chain.Polkadot]: {
    chain: Chain.Polkadot,
    displayName: 'Polkadot',
    specName: 'polkadot',
    chainDecimals: 10,
    chainToken: 'DOT',
    ss58Format: 0,
    extrinsicExtraOffset: 1,
  },
  [Chain.Kusama]: {
    chain: Chain.Kusama,
    displayName: 'Kusama',
    specName: 'kusama',
    chainDecimals: 12,
    chainToken: 'KSM',
    ss58Format: 2,
    extrinsicExtraOffset: 1,
  },
  [Chain.Paseo]: {
    chain: Chain.Paseo,
    displayName: 'Paseo',
    specName: 'paseo',
    chainDecimals: 10,
    chainToken: 'PAS',
    ss58Format: 0,
    extrinsicExtraOffset: 1,
  },
  [Chain.AssetHubPolkadot]: {
    chain: Chain.AssetHubPolkadot,
    displayName: 'Asset Hub (Polkadot)',
    specName: 'statemint',
    chainDecimals: 10,
    chainToken: 'DOT',
    ss58Format: 0,
    extrinsicExtraOffset: 2,
  },
  [Chain.AssetHubKusama]: {
    chain: Chain.AssetHubKusama,
    displayName: 'Asset Hub (Kusama)',
    specName: 'statemine',
    chainDecimals: 12,
    chainToken: 'KSM',
    ss58Format: 2,
    extrinsicExtraOffset: 2,
  },
  [Chain.AssetHubPaseo]: {
    chain: Chain.AssetHubPaseo,
    displayName: 'Asset Hub (Paseo)',
    specName: 'asset-hub-paseo',
    chainDecimals: 10,
    chainToken: 'PAS',
    ss58Format: 0,
    extrinsicExtraOffset: 2,
  },
  [Chain.PeoplePolkadot]: {
    chain: Chain.PeoplePolkadot,
    displayName: 'People (Polkadot)',
    specName: 'people-polkadot',
    chainDecimals: 10,
    chainToken: 'DOT',
    ss58Format: 0,
    extrinsicExtraOffset: 1,
  },
  [Chain.PeopleKusama]: {
    chain: Chain.PeopleKusama,
    displayName: 'People (Kusama)',
    specName: 'people-kusama',
    chainDecimals: 12,
    chainToken: 'KSM',
    ss58Format: 2,
    extrinsicExtraOffset: 1,
  },
  [Chain.PeoplePaseo]: {
    chain: Chain.PeoplePaseo,
    displayName: 'People (Paseo)',
    specName: 'people-paseo',
    chainDecimals: 10,
    chainToken: 'PAS',
    ss58Format: 0,
    extrinsicExtraOffset: 1,
  },
  [Chain.Centrifuge]: {
    chain: Chain.Centrifuge,
    displayName: 'Centrifuge',
    specName: 'centrifuge',
    chainDecimals: 18,
    chainToken: 'CFG',
    ss58Format: 36,
    extrinsicExtraOffset: 1, // TODO: verify
  },
  [Chain.Frequency]: {
    chain: Chain.Frequency,
    displayName: 'Frequency',
    specName: 'frequency',
    chainDecimals: 8,
    chainToken: 'FRQCY',
    ss58Format: 90,
    extrinsicExtraOffset: 1, // TODO: verify
  },
};

export function getChainProperties(chain: Chain): ChainProperties {
  const props = CHAIN_CONFIGS[chain];
  if (!props) {
    throw new Error(`Unsupported chain: ${chain}`);
  }
  return props;
}

export type MonitorHandlerType = {
  [MonitorType.Balances]: BalancesHandlerType;
  [MonitorType.Identity]: IdentityHandlerType;
  [MonitorType.Staking]: StakingHandlerType;
  [MonitorType.Governance]: GovernanceHandlerType;
  [MonitorType.Xcm]: XcmHandlerType;
  [MonitorType.Assets]: AssetsHandlerType;
};

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
