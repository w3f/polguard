import { ConfigAccountSettings, Logger, IdentityField, ChainDataProvider } from '.';
import { Chain, ChainProperties, MonitorType, PolkadotClientImpl } from './constants';
import { NotificationSettings, IncidentHandlerClient } from './incident';
import { CallHandlerParams, EventHandlerParams, StateHandlerParams, MonitorHandlerType, TelemetryHandlerParams } from './handlers';

export interface Monitor {
  processState(params: StateHandlerParams): Promise<void>;
  processEvent(params: EventHandlerParams): Promise<void>;
  processCall(params: CallHandlerParams): Promise<void>;
}

export interface TelemetryMonitor {
  processTelemetry(params: TelemetryHandlerParams): Promise<void>;
}

/**
 * Constructor type for monitors
 * @typeParam T - Type of monitor (e.g., Staking, Identity)
 */
export type MonitorConstructor<T extends MonitorType> = new (
  logger: Logger,
  groups: MonitoringGroup[],
  incidents: IncidentHandlerClient,
  chainProps: ChainProperties,
  provider: ChainDataProvider,
  monitorType: T
) => Monitor;

export interface BaseMonitorSettings {
  annotations?: Record<string, any>;
}

export interface StakingSettings extends BaseMonitorSettings {
  commission: number;
  selfStake?: bigint;
  payee?: string;
  handlers: MonitorHandlerType[MonitorType.Staking][];
}

export interface GovernanceSettings extends BaseMonitorSettings {
  handlers: MonitorHandlerType[MonitorType.Governance][];
}

export interface BalancesSettings extends BaseMonitorSettings {
  threshold?: bigint;
  handlers: MonitorHandlerType[MonitorType.Balances][];
}

export type IdentitySettings = {
  [K in IdentityField]?: string;
} & {
  handlers: MonitorHandlerType[MonitorType.Identity][];
} & BaseMonitorSettings;

export interface TelemetrySettings extends BaseMonitorSettings {
  handlers: MonitorHandlerType[MonitorType.Telemetry][];
  cpu?: string;
  minMemoryGB?: number;
  minCores?: number;
  clientVersion?: Partial<Record<PolkadotClientImpl, string>>;
  provider?: string;
  sanctionedCountries?: string[];
  sanctionedRegions?: string[];
}

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
  [MonitorType.Telemetry]: TelemetrySettings;
  [MonitorType.Xcm]: XcmSettings;
  [MonitorType.Assets]: AssetsSettings;
};

export type MonitorSettings<T extends MonitorType> = MonitorTypeSettings[T];

export interface MonitoringGroup {
  id: string;
  chain: Chain;
  monitors: MonitorConfig[];
  accounts: ConfigAccountSettings[];
  notifications: NotificationSettings;
  annotations?: Record<string, any>;
}

export interface MonitorConfig {
  name: MonitorType;
  settings: MonitorTypeSettings[MonitorType];
}
