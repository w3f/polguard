import { Chain, MonitorType, AlertSettings } from '@w3f/monitoring-types';

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
  id: string;
  chains?: Chain[];
  monitors?: RawMonitorSettings[];
  alerts?: AlertSettings;
  accounts: RawAccountSettings[];
  // TODO: Remove or redesign, this key doesn't belong to monitoring
  enablePayout?: boolean;
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
