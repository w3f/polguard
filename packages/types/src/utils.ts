import '@polkadot/api-augment/polkadot';
import { PalletStakingRewardDestination } from '@polkadot/types/lookup';

export interface Logger {
  log(message: string): void;
  error(message: string): void;
  warn(message: string): void;
  debug(message: string): void;
  verbose(message: string): void;
  fatal(message: string): void;
}

export interface StateQueryProvider {
  validatorCommissions(addresses: string[], blockNumber: number): Promise<Record<string, number>>;
  payees(addresses: string[], blockNumber: number): Promise<Record<string, PalletStakingRewardDestination>>;
  validators(blockNumber: number): Promise<Record<string, boolean>>;
  era(blockNumber: number): Promise<number>;
  balances(addresses: string[], blockNumber: number): Promise<Record<string, bigint>>;
}
