import { MonitorType } from './constants';
import { MonitorSettings } from './monitor';

export type TokenBalances = Record<string, Record<string, bigint>>;

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

export * from './monitor';
export * from './incident';
export * from './handlers';
export * from './clients';
export * from './constants';
export * from './data-provider';
export * from './logging';
export * from './notification';
export * from './telemetry';
