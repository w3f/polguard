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