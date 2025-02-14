import { Chain, MonitorType } from './constants';
import { MonitorSettings } from './monitor';

export interface ChainProperties {
  chain: Chain,
  specName: string;
  chainDecimals: number;
  chainToken: string;
  ss58Format: number;
}

export interface Logger {
  log(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  debug(message: string, ...args: any[]): void;
  verbose(message: string, ...args: any[]): void;
  fatal(message: string, ...args: any[]): void;
}

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
export * from './telemetry';