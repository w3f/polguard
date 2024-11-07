import { Chain, MonitorType } from './constants';
import { BlockHash } from '@polkadot/types/interfaces';
import { EventRecord } from '@polkadot/types/interfaces/system';
import { CallBase } from '@polkadot/types/types/calls';
import { AnyTuple } from '@polkadot/types/types';
import { ApiPromise } from '@polkadot/api';
import { IncidentHandler } from './incident/incident-handler';
import { ChainWatcherStore } from './store/chain-watcher-store';

// TODO: Refactor interfaces, split into smaller chunks.
export interface Monitor {
  processEveryBlock(params: EveryBlockHandlerParams): Promise<void>;
  processEvent(params: EventHandlerParams): Promise<void>;
  processCall(params: CallHandlerParams): Promise<void>;
}

export interface MonitorConstructor {
  new(logger: Logger, api: ApiPromise, groups: MonitoringGroup[], incidentHandler: IncidentHandler, store: ChainWatcherStore, monitorType: MonitorType): Monitor;
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

export interface ConfigAccountSettings extends AccountId {
  [MonitorType: string]: any;
}


export interface AccountSettings<T extends MonitorType> extends AccountId {
  settings: MonitorSettings<T>;
}

// Alert-related interfaces
// TODO: Update AlertSettings to use MessengerType enum instead
// TODO: Remove escalation
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

export type MonitorTypeSettings = {
  [MonitorType.Validator]: ValidatorSettings;
  [MonitorType.Governance]: GovernanceSettings;
  [MonitorType.TransactionIngress]: TransactionSettings;
  [MonitorType.TransactionEgress]: TransactionSettings;
  [MonitorType.BalanceIncrement]: BalanceSettings;
  [MonitorType.BalanceDecrement]: BalanceSettings;
  [MonitorType.BalanceThreshold]: BalanceSettings;
}

export type MonitorSettings<T extends MonitorType> = MonitorTypeSettings[T];

export interface MonitorConfig {
  name: MonitorType;
  settings?: MonitorTypeSettings[MonitorType];
}

export interface MonitoringGroup {
  name: string;
  chain: Chain;
  monitors: MonitorConfig[];
  accounts: ConfigAccountSettings[];
  alerts: AlertSettings;
}

export interface StorageClient {
  set(key: string, value: string): Promise<void>;
  setex(key: string, ttl: number, value: string): Promise<void>;
  get(key: string): Promise<string | null>;
  del(key: string): Promise<void>;
}

export interface EventEmitterClient {
  emit(event: string , payload: any): Promise<boolean>;
}

export interface CallHandlerParams {
  call: CallBase<AnyTuple>;
  origin: string;
  blockHash: BlockHash;
  blockNumber: number;
}

export interface EventHandlerParams {
  eventRecord: EventRecord;
  blockHash: BlockHash;
  blockNumber: number;
}

export interface EveryBlockHandlerParams {
  blockHash: BlockHash;
  blockNumber: number;
}

export interface Message {
  title: string;
  details: string[];
}

export interface ChainWatcherMetrics {
  setBlockHeight(height: number): void;
}
