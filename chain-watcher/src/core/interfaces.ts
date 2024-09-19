import { Chain, MonitorType } from './constants';
import { BlockHash } from '@polkadot/types/interfaces';
import { EventRecord } from '@polkadot/types/interfaces/system';
import { Call } from '@polkadot/types/interfaces/runtime';
import { ApiPromise } from '@polkadot/api';

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

export interface MonitoringGroup {
  name: string;
  chain: Chain;
  accounts: AccountId[];
  monitors: MonitorSettings[];
  alerts: AlertSettings;
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

interface BaseMonitor {
  name: MonitorType;
}

interface ValidatorMonitorSettings extends BaseMonitor {
  name: MonitorType.Validator;
  defaults: {
    commission?: number;
    payee?: AccountId;
  }
}

interface GovernanceMonitorSettings extends BaseMonitor {
  name: MonitorType.Governance;
}

interface TransactionMonitorSettings extends BaseMonitor {
  name: MonitorType.Transaction;
}

export type MonitorSettings = ValidatorMonitorSettings | 
                              GovernanceMonitorSettings | 
                              TransactionMonitorSettings;
