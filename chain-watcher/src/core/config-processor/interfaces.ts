import { Chain, MonitorType } from '../constants';
import { AlertSettings } from '../interfaces';

export interface RawConfig {
  version: string;
  defaults: {
    alerts: AlertSettings;
  };
  groups: RawMonitoringGroup[];
}

export interface RawMonitoringGroup {
  name: string;
  chains: Chain[];
  monitors: { name: MonitorType; commission?: number; payee?: string; }[];
  accounts: { name: string; address: string }[];
  alerts?: AlertSettings;
}
