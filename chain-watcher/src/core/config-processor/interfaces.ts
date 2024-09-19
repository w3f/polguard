import { Chain, MonitorType } from '../constants';
import { AlertSettings } from '../interfaces';

export interface RawConfig {
  version: string;
  defaults: {
    chains: Chain[];
    monitors: RawMonitor[];
    alerts: AlertSettings;
  };
  groups: RawMonitoringGroup[];
}

export interface RawMonitoringGroup {
  name: string;
  chains?: Chain[];
  monitors?: RawMonitor[];
  alerts?: AlertSettings;
  accounts: { name: string; address: string }[];
};

export interface RawMonitor {
  name: MonitorType;
  defaults?: {
    commission?: number;
    payee?: string;
  }
}