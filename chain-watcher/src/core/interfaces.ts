import { Chain, MonitorType } from './constants';
import { BlockHash } from '@polkadot/types/interfaces';
import { EventRecord } from '@polkadot/types/interfaces/system';
import { Call } from '@polkadot/types/interfaces/runtime';

export interface EventDispatcher {
  emit(eventName: string | symbol, ...args: any[]): boolean;
  on(eventName: string | symbol, listener: (...args: any[]) => void): this;
  off(eventName: string | symbol, listener: (...args: any[]) => void): this;
}

export interface HandlerContext<T> {
  blockHash: BlockHash;
  data: T;
  group: MonitoringGroup;
}

export type MonitorHandler<T> = (context: HandlerContext<T>) => Promise<Incident[]>;

export interface Monitor {
  processBlock(blockHash: BlockHash, blockNumber: number): Promise<void>;
  processEvent(blockHash: BlockHash, eventRecord: EventRecord): Promise<void>;
  processCall(blockHash: BlockHash, call: Call): Promise<void>;
}


export interface Logger {
  log(message: string): void;
  error(message: string): void;
  warn(message: string): void;
  debug(message: string): void;
  verbose(message: string): void;
  fatal(message: string): void;
}
export interface AccountId {
  ss58: string;
  hex: string;
  name: string;
}

export interface ValidatorSettings {
  commission?: number;
  payee?: string;
}

export interface GovernanceSettings {
}

export interface TransactionSettings {
}

export interface AlertSettings {
  matrix: {
    rooms: string[];
    escalation?: {
      timeout: number;
      rooms: string[];
    };
  };
}

export interface Incident {
  message: string;
  alerts: AlertSettings;
}

export type MonitorSettings = {
  [MonitorType.Validator]: ValidatorSettings;
  [MonitorType.Governance]: GovernanceSettings;
  [MonitorType.Transaction]: TransactionSettings;
}

export interface MonitorConfig {
  name: MonitorType;
  settings: MonitorSettings[MonitorType];
}

export interface AccountSettings extends AccountId {
  [MonitorType.Validator]?: ValidatorSettings;
  [MonitorType.Governance]?: GovernanceSettings;
  [MonitorType.Transaction]?: TransactionSettings;
}

export interface MonitoringGroup {
  name: string;
  chain: Chain;
  monitors: MonitorConfig[];
  accounts: AccountSettings[];
  alerts: AlertSettings;
}
