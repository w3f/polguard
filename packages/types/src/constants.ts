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
}

export enum BalancesHandlerType {
  BalanceChange = 'BalanceChange',
  BalanceThreshold = 'BalanceThreshold',
  TransferIngress = 'TransferIngress',
  TransferEgress = 'TransferEgress',
}

export enum IdentityHandlerType {
  IdentityUnexpected = 'IdentityUnexpected',
}

export enum GovernanceHandlerType {
  ReferendaSubmitted = 'ReferendaSubmitted',
  ConvictionVoted = 'ConvictionVoted',
}
