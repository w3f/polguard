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
  BalanceThreshold = 'BalanceThreshold'
}

export enum CacheKey {
  Balances = 'balances',
}
