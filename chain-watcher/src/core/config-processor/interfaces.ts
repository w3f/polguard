import { Chain, MonitorType } from '../constants';
import { AlertSettings } from '../interfaces';

export interface RawConfig {
  version: string;
  defaults: {
    chains: Chain[];
    monitors: RawMonitorSettings[];
    alerts: AlertSettings;
  };
  groups: RawMonitoringGroup[];
}

export interface RawMonitoringGroup {
  name: string;
  chains?: Chain[];
  monitors?: RawMonitorSettings[];
  alerts?: AlertSettings;
  accounts: RawAccountSettings[];
}

export interface RawMonitorSettings {
  name: MonitorType;
  [key: string]: any;
}

export interface RawAccountSettings {
  name?: string;
  address: string;
  [key: string]: any;
}