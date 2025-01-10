export interface IdentityInfo {
  display?: string,
  legal?: string,
  web?: string,
  matrix?: string,
  email?: string,
  image?: string,
  twitter?: string,
  github?: string,
  discord?: string,
}

export interface StateQueryProvider {
  stakingValidatorsComission(addresses: string[], blockNumber: number): Promise<Record<string, number | null>>;
  stakingLedgerActive(addresses: string[], blockNumber: number): Promise<Record<string, bigint | null>>;
  stakingBonded(addresses: string[], blockNumber: number): Promise<Record<string, string | null>>;
  stakingPayee(addresses: string[], blockNumber: number): Promise<Record<string, string | null>>;
  stakingActiveEra(blockNumber: number): Promise<number>;
  sessionValidators(blockNumber: number): Promise<Record<string, boolean>>;
  systemAccountBalance(addresses: string[], blockNumber: number): Promise<Record<string, bigint>>;
  identityOf(addresses: string[], blockNumber: number): Promise<Record<string, IdentityInfo | null>>;
}
