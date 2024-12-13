import { MonitorType } from '../constants';
import { MonitorSettings } from './monitor';

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
