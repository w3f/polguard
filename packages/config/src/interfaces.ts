import { Chain, MonitorType, NotificationSettings } from '@w3f/polguard-common';

export interface RawMonitoringGroup {
  id: string;
  chains?: Chain[];
  monitors?: RawMonitorSettings[];
  notifications?: NotificationSettings;
  accounts: RawAccountSettings[];
  annotations?: Record<string, any>;
}

export interface RawMonitorSettings {
  name: MonitorType;
  annotations?: Record<string, any>;
  [key: string]: any;
}

export interface RawAccountSettings {
  name?: string;
  address: string;
  annotations?: Record<string, any>;
  [key: string]: any;
}
