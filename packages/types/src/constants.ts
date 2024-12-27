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

export enum ValidatorHandlerType {
  SlashReported = 'SlashReported',
  CommissionChanged = 'CommissionChanged',
  DestinationChanged = 'DestinationChanged',
  CommissionUnexpected = 'CommissionUnexpected',
  DestinationUnexpected = 'DestinationUnexpected',
  ActiveSetPresence = 'ActiveSetPresence'
}

export enum BalanceThresholdHandlerType {
  BalanceThreshold = 'BalanceThreshold',
}

export enum BalanceHandlerType {
  ChangeBalance = 'ChangeBalance',
}

export enum GovernanceHandlerType {
  ReferendaSubmitted = 'ReferendaSubmitted',
  ConvictionVoted = 'ConvictionVoted',
}

export enum TransactionHandlerType {
  BalancesTransfer = 'BalancesTransfer',
}

export type MonitorHandlerType = {
  [MonitorType.Validator]: ValidatorHandlerType;
  [MonitorType.BalanceThreshold]: BalanceThresholdHandlerType;
  [MonitorType.Governance]: GovernanceHandlerType;
  [MonitorType.TransactionIngress]: TransactionHandlerType;
  [MonitorType.TransactionEgress]: TransactionHandlerType;
  [MonitorType.BalanceIncrement]: BalanceHandlerType;
  [MonitorType.BalanceDecrement]: BalanceHandlerType;
};

export type HandlerType = 
  | ValidatorHandlerType 
  | BalanceThresholdHandlerType 
  | BalanceHandlerType 
  | GovernanceHandlerType 
  | TransactionHandlerType;