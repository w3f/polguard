import { Chain, MonitorType, MonitorHandlerType } from './constants';
import { NotificationSettings } from './incident';
import { AccountId } from './account';

export interface BaseMonitorSettings {
  annotations?: Record<string, any>;
}

export interface StakingSettings extends BaseMonitorSettings {
  commission: number;
  selfStake?: bigint;
  payee?: string;
  fromEra?: number;
  untilEra?: number;
  handlers: MonitorHandlerType[MonitorType.Staking][];
}

export interface GovernanceSettings extends BaseMonitorSettings {
  handlers: MonitorHandlerType[MonitorType.Governance][];
}

export interface BalancesSettings extends BaseMonitorSettings {
  threshold?: bigint;
  handlers: MonitorHandlerType[MonitorType.Balances][];
}

export type IdentityField = 'display' | 'legal' | 'web' | 'matrix' | 'email' | 'image' | 'twitter' | 'github' | 'discord';

export const IDENTITY_FIELDS: IdentityField[] = [
  'display',
  'legal',
  'web',
  'matrix',
  'email',
  'image',
  'twitter',
  'github',
  'discord',
];

export type IdentitySettings = {
  [K in IdentityField]?: string;
} & {
  handlers: MonitorHandlerType[MonitorType.Identity][];
} & BaseMonitorSettings;

export interface XcmSettings extends BaseMonitorSettings {
  handlers: MonitorHandlerType[MonitorType.Xcm][];
}

export interface AssetsSettings extends BaseMonitorSettings {
  tokens?: string[];
  tokenThresholds?: [string, bigint][];
  handlers: MonitorHandlerType[MonitorType.Assets][];
}

export type MonitorTypeSettings = {
  [MonitorType.Staking]: StakingSettings;
  [MonitorType.Governance]: GovernanceSettings;
  [MonitorType.Balances]: BalancesSettings;
  [MonitorType.Identity]: IdentitySettings;
  [MonitorType.Xcm]: XcmSettings;
  [MonitorType.Assets]: AssetsSettings;
};

export interface MonitorConfig {
  name: MonitorType;
  settings: MonitorTypeSettings[MonitorType];
}

export interface MonitoringGroup {
  id: string;
  chain: Chain;
  monitors: MonitorConfig[];
  accounts: ConfigAccountSettings[];
  notifications: NotificationSettings;
  annotations?: Record<string, any>;
}

export interface ConfigAccountSettings extends AccountId {
  [monitorType: string]: any;
}
