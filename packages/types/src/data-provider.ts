import { IdentityField } from '.';

export type IdentityInfo = {
  [K in IdentityField]?: string;
};

export interface DataProvider {}

export interface TelemetryDataProvider extends DataProvider {}

export interface ChainDataProvider extends DataProvider {
  stakingValidators(blockNumber: number): Promise<Set<string>>;
  stakingValidatorsCommission(addresses: string[], blockNumber: number): Promise<Record<string, number | null>>;
  stakingLedgerActive(addresses: string[], blockNumber: number): Promise<Record<string, bigint | null>>;
  stakingBonded(addresses: string[], blockNumber: number): Promise<Record<string, string | null>>;
  stakingPayee(addresses: string[], blockNumber: number): Promise<Record<string, string | null>>;
  stakingActiveEra(blockNumber: number): Promise<number>;
  sessionValidators(blockNumber: number): Promise<Record<string, boolean>>;
  systemAccountBalance(addresses: string[], blockNumber: number): Promise<Record<string, bigint>>;
  identityOf(addresses: string[], blockNumber: number): Promise<Record<string, IdentityInfo | null>>;
  identitySuperOf(addresses: string[], blockNumber: number): Promise<Record<string, string | null>>;
}
