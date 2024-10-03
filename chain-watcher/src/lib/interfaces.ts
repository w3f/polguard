import { Chain, MonitorType } from './constants';
import { BlockHash } from '@polkadot/types/interfaces';
import { EventRecord } from '@polkadot/types/interfaces/system';
import { Call } from '@polkadot/types/interfaces/runtime';
import { ApiPromise } from '@polkadot/api';
import { IncidentHandler } from './incident/incident-handler';
import { ChainWatcherStore } from './store/chain-watcher-store';

export interface Monitor {
  processBlock(blockHash: BlockHash, blockNumber: number): Promise<void>;
  processEvent(blockHash: BlockHash, blockNumber: number, eventRecord: EventRecord): Promise<void>;
  processCall(blockHash: BlockHash, blockNumber: number, call: Call): Promise<void>;
}

export interface MonitorConstructor {
  new(api: ApiPromise, groups: MonitoringGroup[], incidentHandler: IncidentHandler, store: ChainWatcherStore): Monitor;
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
    targets: string[];
    acknowledgement?: {
      escalation?: {
        timeout: number;
        targets: string[];
      };
    };
  };
}

export interface IncidentEvent {
  id: string;
  blockNumber: number;
  chain: Chain;
  message: string;
  alerts: AlertSettings;
}

export interface IncidentResolvedEvent {
  id: string;
  blockNumber: number;
  chain: Chain;
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
  settings?: MonitorSettings[MonitorType];
}

export interface MonitoringGroup {
  name: string;
  chain: Chain;
  monitors: MonitorConfig[];
  accounts: AccountSettings[];
  alerts: AlertSettings;
}

export interface StorageClient {
  set(key: string, value: string): Promise<void>;
  setex(key: string, ttl: number, value: string): Promise<void>;
  get(key: string): Promise<string | null>;
  del(key: string): Promise<void>;
}

export interface MessageBroker {
  publish(channel: string, message: string): Promise<void>;
}
