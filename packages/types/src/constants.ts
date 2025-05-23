export interface ChainProperties {
  chain: Chain,
  specName: string;
  chainDecimals: number;
  chainToken: string;
  ss58Format: number;
}

export enum Chain {
  Polkadot = 'Polkadot',
  Kusama = 'Kusama',
  AssetHubPolkadot = 'AssetHubPolkadot',
  AssetHubKusama = 'AssetHubKusama',
  PeoplePolkadot = 'PeoplePolkadot',
  PeopleKusama = 'PeopleKusama',
  Centrifuge = 'Centrifuge',
}

export enum MonitorType {
  Balances = 'Balances',
  Identity = 'Identity',
  Staking = 'Staking',
  Governance = 'Governance',
  Telemetry = 'Telemetry',
  Xcm = 'Xcm',
  Assets = 'Assets',
}

export enum MessageType {
  Firing = 'Firing',
  Resolved = 'Resolved',
  OneTime = 'Event',
}

export enum MessengerType {
  Matrix = 'matrix',
  Slack = 'slack',
  Telegram = 'telegram',
}

export enum NotificationType {
  Alert = 'alert',
  Resolution = 'resolution',
}

export enum StakingHandlerType {
  SlashReported = 'SlashReported',
  CommissionChanged = 'CommissionChanged',
  Unbonded = 'Unbonded',
  DestinationChanged = 'DestinationChanged',
  CommissionUnexpected = 'CommissionUnexpected',
  DestinationUnexpected = 'DestinationUnexpected',
  SelfStakeUnexpected = 'SelfStakeUnexpected',
  ActiveSetPresence = 'ActiveSetPresence',
  ValidatorIntentionMissing = 'ValidatorIntentionMissing',
}

export enum BalancesHandlerType {
  BalanceDecrease = 'BalanceDecrease',
  BalanceThreshold = 'BalanceThreshold',
  TransferIngress = 'TransferIngress',
  TransferEgress = 'TransferEgress',
  Transfer = 'Transfer',
}

export enum IdentityHandlerType {
  IdentityUnexpected = 'IdentityUnexpected',
  IdentityChanged = 'IdentityChanged',
  IdentityMissing = 'IdentityMissing',
  IdentityFieldsMissing = 'IdentityFieldsMissing',
}

export enum TelemetryHandlerType {
  LocationUnexpected = 'LocationUnexpected',
  ProviderUnexpected = 'ProviderUnexpected',
  VersionOutdated = 'VersionOutdated',
  HardwareUnexpected = 'HardwareUnexpected',
  TelemetryMissing = 'TelemetryMissing',
  IpSpoofing = 'IpSpoofing'
}

export enum GovernanceHandlerType {
  ReferendaSubmitted = 'ReferendaSubmitted',
  ConvictionVote = 'ConvictionVote',
}

export enum XcmHandlerType {
  XcmTransferEgress = 'XcmTransferEgress',
}

export enum AssetsHandlerType {
  AssetBalanceDecrease = 'AssetBalanceDecrease',
  AssetBalanceThreshold = 'AssetBalanceThreshold',
  AssetTransferIngress = 'AssetTransferIngress',
  AssetTransferEgress = 'AssetTransferEgress',
}

export const CHAIN_CONFIGS: Record<Chain, ChainProperties> = {
  [Chain.Polkadot]: {
    chain: Chain.Polkadot,
    specName: 'polkadot',
    chainDecimals: 10,
    chainToken: 'DOT',
    ss58Format: 0,
  },
  [Chain.Kusama]: {
    chain: Chain.Kusama,
    specName: 'kusama',
    chainDecimals: 12,
    chainToken: 'KSM',
    ss58Format: 2,
  },
  [Chain.AssetHubPolkadot]: {
    chain: Chain.AssetHubPolkadot,
    specName: 'assethub-polkadot',
    chainDecimals: 10,
    chainToken: 'DOT',
    ss58Format: 0,
  },
  [Chain.AssetHubKusama]: {
    chain: Chain.AssetHubKusama,
    specName: 'assethub-kusama',
    chainDecimals: 12,
    chainToken: 'KSM',
    ss58Format: 2,
  },
  [Chain.PeoplePolkadot]: {
    chain: Chain.PeoplePolkadot,
    specName: 'people-polkadot',
    chainDecimals: 10,
    chainToken: 'DOT',
    ss58Format: 0,
  },
  [Chain.PeopleKusama]: {
    chain: Chain.PeopleKusama,
    specName: 'people-kusama',
    chainDecimals: 12,
    chainToken: 'KSM',
    ss58Format: 2,
  },
  [Chain.Centrifuge]: {
    chain: Chain.Centrifuge,
    specName: 'centrifuge',
    chainDecimals: 18,
    chainToken: 'CFG',
    ss58Format: 36,
  },
} as const;

export function getChainProperties(chain: Chain): ChainProperties {
  const props = CHAIN_CONFIGS[chain];
  if (!props) {
    throw new Error(`Unsupported chain: ${chain}`);
  }
  return props;
}

export enum PolkadotClientImpl {
  ParityPolkadot = 'Parity Polkadot',
  KagomeNode = 'Kagome Node'
}

export const IDENTITY_FIELDS = [
  'display',
  'legal',
  'web',
  'matrix',
  'email',
  'image',
  'twitter',
  'github',
  'discord'
] as const;

export type IdentityField = (typeof IDENTITY_FIELDS)[number];

export const PARACHAIN_NAMES = {
  [Chain.Polkadot]: {
    '1000': 'AssetHubPolkadot',
    '1001': 'CollectivesPolkadot',
    '1002': 'BridgeHubPolkadot',
    '1004': 'PeoplePolkadot',
    '2000': 'Acala',
    '2002': 'Clover',
    '2004': 'Moonbeam',
    '2006': 'Astar',
    '2008': 'Crust',
    '2012': 'Parallel',
    '2013': 'Litentry',
    '2025': 'SORA',
    '2026': 'Nodle',
    '2030': 'Bifrost',
    '2031': 'Centrifuge',
    '2032': 'Interlay',
    '2034': 'Hydration',
    '2035': 'Phala Network',
    '2037': 'Unique Network',
    '2040': 'Polkadex',
    '2043': 'NeuroWeb',
    '2046': 'Darwinia2',
    '2051': 'Ajuna',
    '2056': 'Aventus',
    '2086': 'KILT Protocol',
    '2090': 'OAK Network',
    '2092': 'Zeitgeist',
    '2093': 'Hashed Network',
    '2094': 'Pendulum',
    '2104': 'Manta',
    '3338': 'peaq',
    '3345': 'Energy Web X',
    '3346': 'Continuum',
    '3369': 'Mythos'
  },
  [Chain.Kusama]: {
    '1000': 'AssetHubKusama',
    '1001': 'CollectivesKusama',
    '1002': 'BridgeHubKusama',
    '1004': 'PeopleKusama',
    '1005': 'Coretime',
    '2000': 'Karura',
    '2001': 'Bifrost',
    '2004': 'Khala Network',
    '2007': 'Shiden',
    '2011': 'SORA',
    '2012': 'Crust Shadow',
    '2023': 'Moonriver',
    '2024': 'Genshiro',
    '2048': 'Robonomics',
    '2084': 'Calamari',
    '2087': 'Picasso',
    '2090': 'Basilisk',
    '2092': 'Kintsugi',
    '2095': 'Quartz',
    '2096': 'Pioneer',
    '2105': 'Crab2',
    '2106': 'Litmus',
    '2110': 'Mangata',
    '2113': 'Kabocha',
    '2114': 'Turing Network',
    '2119': 'Bajun Network',
    '2239': 'Acurast',
    '2241': 'krest',
    '2281': 'Kreivo',
    '3339': 'Curio',
    '3344': 'Xode'
  }
};

export const CHAIN_TOKENS: Record<Chain, Record<string, { id: string; decimals: number }>> = {
  [Chain.AssetHubPolkadot]: {
    USDC: { id: '1337', decimals: 6 },
    USDT: { id: '1984', decimals: 6 },
  },
  [Chain.AssetHubKusama]: {
    USDT: { id: '1984', decimals: 6 },
  },
  [Chain.Polkadot]: {},
  [Chain.Kusama]: {},
  [Chain.PeoplePolkadot]: {},
  [Chain.PeopleKusama]: {},
  [Chain.Centrifuge]: {
    localUSDC: { id: '{"localAsset":1}', decimals: 6 },
  },
};

export const ID_TOKEN_MAP: Record<Chain, Record<string, string>> = Object.fromEntries(
  Object.entries(CHAIN_TOKENS).map(([chain, tokenMetas]) => [
    chain,
    Object.fromEntries(
      Object.entries(tokenMetas).map(([symbol, { id }]) => [id, symbol])
    ),
  ])
) as Record<Chain, Record<string, string>>;
