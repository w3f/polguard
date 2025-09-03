import { IdentityField } from '.';
import '@polkadot/api-augment/polkadot';
import { ApiDecoration } from '@polkadot/api/types';

export type IdentityInfo = {
  [K in IdentityField]?: string;
};
export interface ChainDataProvider {
  initializeBlock(blockNumber: number, apiAt: ApiDecoration<'promise'>): void;
  stakingValidators(blockNumber: number): Promise<string[]>;
  stakingValidatorsCommission(addresses: string[], blockNumber: number): Promise<Record<string, number | null>>;
  stakingLedgerActive(addresses: string[], blockNumber: number): Promise<Record<string, bigint | null>>;
  stakingBonded(addresses: string[], blockNumber: number): Promise<Record<string, string | null>>;
  stakingPayee(addresses: string[], blockNumber: number): Promise<Record<string, string | null>>;
  stakingActiveEra(blockNumber: number): Promise<number>;
  sessionValidators(blockNumber: number): Promise<Record<string, boolean>>;
  systemAccountBalance(addresses: string[], blockNumber: number): Promise<Record<string, bigint>>;
  identityOf(addresses: string[], blockNumber: number): Promise<Record<string, IdentityInfo | null>>;
  identitySuperOf(addresses: string[], blockNumber: number): Promise<Record<string, string | null>>;
  assetsAccountBalance(addresses: string[], tokenNames: string[], blockNumber: number): Promise<Record<string, Record<string, bigint>>>;
  ormlTokensAccountBalance(addresses: string[], tokenNames: string[], blockNumber: number): Promise<Record<string, Record<string, bigint>>>;
  referendaInfoFor(referendumIndex: string | number, blockNumber: number): Promise<string | null>;
  referendaTrack(trackId: number | string, blockNumber: number): Promise<string>;
}
