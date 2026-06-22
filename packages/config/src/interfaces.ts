import { Chain, MonitorType, NotificationSettings, Operations } from '@w3f/polguard-common';

export interface RawMonitoringGroup {
  id: string;
  chains?: Chain[];
  monitors?: RawMonitorSettings[];
  notifications?: NotificationSettings;
  accounts: RawAccountSettings[];
  annotations?: Record<string, any>;
  operations?: Operations;
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
  operations?: Operations;
  [key: string]: any;
}
