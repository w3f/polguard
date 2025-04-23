import { ChainProperties, ConfigAccountSettings, Logger, IdentityField, ChainDataProvider } from '.';
import { Chain, ComparisonType, MonitorType, PolkadotClientImpl } from './constants';
import { AlertSettings, IncidentHandlerClient } from './incident';
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

export interface StakingSettings {
  commission: number;
  commissionComparison: ComparisonType;
  selfStakeComparison: ComparisonType;
  selfStake?: bigint;
  payee?: string;
  handlers: MonitorHandlerType[MonitorType.Staking][];
}

export interface GovernanceSettings {
  handlers: MonitorHandlerType[MonitorType.Governance][];
}

export interface BalancesSettings {
  threshold?: bigint;
  changeComparison: ComparisonType;
  handlers: MonitorHandlerType[MonitorType.Balances][];
}

export type IdentitySettings = {
  [K in IdentityField]?: string;
} & {
  handlers: MonitorHandlerType[MonitorType.Identity][];
};

export interface TelemetrySettings {
  handlers: MonitorHandlerType[MonitorType.Telemetry][];
  cpu?: string;
  minMemoryGB?: number;
  minCores?: number;
  clientVersion?: Partial<Record<PolkadotClientImpl, string>>;
  provider?: string;
  sanctionedCountries?: string[];
  sanctionedRegions?: string[];
}

export interface XcmSettings {
  handlers: MonitorHandlerType[MonitorType.Xcm][];
}

export type MonitorTypeSettings = {
  [MonitorType.Staking]: StakingSettings;
  [MonitorType.Governance]: GovernanceSettings;
  [MonitorType.Balances]: BalancesSettings;
  [MonitorType.Identity]: IdentitySettings;
  [MonitorType.Telemetry]: TelemetrySettings;
  [MonitorType.Xcm]: XcmSettings;
};

export type MonitorSettings<T extends MonitorType> = MonitorTypeSettings[T];

export interface MonitoringGroup {
  id: string;
  chain: Chain;
  monitors: MonitorConfig[];
  accounts: ConfigAccountSettings[];
  alerts: AlertSettings;
  // TODO: Remove or redesign, this key doesn't belong to monitoring
  enablePayout?: boolean;
}

export interface MonitorConfig {
  name: MonitorType;
  settings: MonitorTypeSettings[MonitorType];
}
