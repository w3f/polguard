export enum Chain {
  Polkadot = 'Polkadot',
  Kusama = 'Kusama',
  // Centrifuge is currently not supported
  Centrifuge = 'Centrifuge',
}

export enum MonitorType {
  Validator = 'Validator',
  Governance = 'Governance',
  TransactionIngress = 'TransactionIngress',
  TransactionEgress = 'TransactionEgress',
  BalanceIncrement = 'BalanceIncrement',
  BalanceDecrement = 'BalanceDecrement',
  BalanceThreshold = 'BalanceThreshold',
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
