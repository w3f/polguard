import { ChainProperties } from '.';

export enum WatcherType {
  Chain = 'Chain',
  Telemetry = 'Telemetry',
}

export enum Chain {
  Polkadot = 'Polkadot',
  Kusama = 'Kusama',
  PeoplePolkadot = 'PeoplePolkadot',
  PeopleKusama = 'PeopleKusama',
  // Centrifuge is currently not supported
  Centrifuge = 'Centrifuge',
}

export enum MonitorType {
  Balances = 'Balances',
  Identity = 'Identity',
  Staking = 'Staking',
  Governance = 'Governance',
  Telemetry = 'Telemetry',
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

export enum ComparisonType {
  Equal = 'eq',
  GreaterThan = 'gt',
  LessThan = 'lt',
  GreaterThanOrEqual = 'gte',
  LessThanOrEqual = 'lte',
}

export enum StakingHandlerType {
  SlashReported = 'SlashReported',
  CommissionChanged = 'CommissionChanged',
  DestinationChanged = 'DestinationChanged',
  CommissionUnexpected = 'CommissionUnexpected',
  DestinationUnexpected = 'DestinationUnexpected',
  SelfStakeUnexpected = 'SelfStakeUnexpected',
  ActiveSetPresence = 'ActiveSetPresence',
  ValidatorIntentionMissing = 'ValidatorIntentionMissing',
}

export enum BalancesHandlerType {
  BalanceChange = 'BalanceChange',
  BalanceThreshold = 'BalanceThreshold',
  TransferIngress = 'TransferIngress',
  TransferEgress = 'TransferEgress',
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
  ConvictionVoted = 'ConvictionVoted',
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
