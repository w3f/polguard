import { Chain, MonitorType } from './constants';
import { BlockHash } from '@polkadot/types/interfaces';
import { EventRecord } from '@polkadot/types/interfaces/system';
import { Call } from '@polkadot/types/interfaces/runtime';
import { ApiPromise } from '@polkadot/api';

export interface EventDispatcher {
  emitIncident(incident: Incident): Promise<void>;
}

export interface Monitor {
  processBlock(blockHash: BlockHash, blockNumber: number): Promise<void>;
  processEvent(blockHash: BlockHash, eventRecord: EventRecord): Promise<void>;
  processCall(blockHash: BlockHash, call: Call): Promise<void>;
}

export interface MonitorConstructor {
  new(api: ApiPromise, groups: MonitoringGroup[], eventDispatcher: EventDispatcher): Monitor;
}

export interface Logger {
  log(message: string): void;
  error(message: string): void;
  warn(message: string): void;
  debug(message: string): void;
  verbose(message: string): void;
  fatal(message: string): void;
}

// Account-related interfaces
export interface AccountId {
  ss58: string;
  hex: string;
  name: string;
}

export type AccountSettings = AccountId & Partial<MonitorSettings>;

// Alert-related interfaces
export interface AlertSettings {
  matrix: {
    rooms: string[];
    acknowledgement?: {
      escalation?: {
        timeout: number;
        rooms: string[];
      };
    };
  };
}

export interface Incident {
  message: string;
  alerts: AlertSettings;
}

// Monitor-specific settings interfaces
export interface ValidatorSettings {
  commission: number;
  payee?: string;
}

export interface GovernanceSettings {}

export interface TransactionSettings {}

export interface BalanceSettings {
  balanceThreshold?: bigint;
}

export type MonitorSettings = {
  [MonitorType.Validator]: ValidatorSettings;
  [MonitorType.Governance]: GovernanceSettings;
  [MonitorType.TransactionIngress]: TransactionSettings;
  [MonitorType.TransactionEgress]: TransactionSettings;
  [MonitorType.BalanceIncrement]: BalanceSettings;
  [MonitorType.BalanceDecrement]: BalanceSettings;
  [MonitorType.BalanceThreshold]: BalanceSettings;
}

export interface MonitorConfig {
  name: MonitorType;
  settings: MonitorSettings[MonitorType];
}

export interface MonitoringGroup {
  name: string;
  chain: Chain;
  monitors: MonitorConfig[];
  accounts: AccountSettings[];
  alerts: AlertSettings;
}
