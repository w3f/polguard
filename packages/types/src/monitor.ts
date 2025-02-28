import { ChainProperties, ConfigAccountSettings, Logger, IdentityField } from '.';
import { Chain, ComparisonType, MonitorType, PolkadotClientImpl } from './constants';
import { AlertSettings, IncidentHandlerClient } from './incident';
import { CallHandlerParams, EventHandlerParams, EveryBlockHandlerParams, MonitorHandlerType, TelemetryHandlerParams } from './handlers';
import { DataProvider } from './data-provider';

/**
 * Defines threshold levels for alert firing based on consecutive check failures.
 * Higher thresholds help reduce alert noise by requiring more confirmations.
 */
export interface AlertFiringThresholds {
  /**
   * High threshold for noisy conditions
   * Requires many consecutive failures before firing
   * Use for conditions that may frequently trigger falsely
   */
  tolerant: number;

  /**
   * Standard threshold for regular alerts
   * Balanced number of confirmations required
   * Default for most monitoring conditions
   */
  moderate: number;

  /**
   * Low threshold that fires quickly
   * Minimal confirmation needed
   * Use for stable conditions unlikely to trigger falsely
   */
  sensitive: number;
}

/**
 * Base monitor interface that all monitors must implement
 */
export interface Monitor<T extends MonitorType> {
  // Common monitor methods could go here if needed
}

/**
 * Telemetry-specific monitor interface
 */
export interface TelemetryMonitor<T extends MonitorType> extends Monitor<T> {
  processTelemetry(params: TelemetryHandlerParams): Promise<void>;
}

/**
 * Chain-specific monitor interface
 */
export interface ChainMonitor<T extends MonitorType> extends Monitor<T> {
  processEveryBlock(params: EveryBlockHandlerParams): Promise<void>;
  processEvent(params: EventHandlerParams): Promise<void>;
  processCall(params: CallHandlerParams): Promise<void>;
}

/**
 * Constructor type for monitors
 * @typeParam T - Type of monitor (e.g., Staking, Identity)
 * @typeParam M - Specific monitor implementation (e.g., ChainMonitor, TelemetryMonitor)
 * @typeParam D - Type of data provider used by the monitor
 */
export type MonitorConstructor<
  T extends MonitorType,
  M extends Monitor<T>,
  D extends DataProvider
> = new (
  logger: Logger,
  groups: MonitoringGroup[],
  incidents: IncidentHandlerClient,
  chainProps: ChainProperties,
  provider: D,
  monitorType: T,
  firingThresholds?: AlertFiringThresholds
) => M;

type HandlerConfig<T> = {
  include: T[];
} | {
  exclude: T[];
};

export interface StakingSettings {
  commission: number;
  commissionComparison: ComparisonType;
  selfStakeComparison: ComparisonType;
  selfStake?: bigint;
  payee?: string;
  handlers?: HandlerConfig<MonitorHandlerType[MonitorType.Staking]>;
}

export interface GovernanceSettings {
  handlers?: HandlerConfig<MonitorHandlerType[MonitorType.Governance]>;
}

export interface BalancesSettings {
  threshold?: bigint;
  changeComparison: ComparisonType;
  handlers?: HandlerConfig<MonitorHandlerType[MonitorType.Balances]>;
}

export type IdentitySettings = {
  [K in IdentityField]?: string;
} & {
  handlers?: HandlerConfig<MonitorHandlerType[MonitorType.Identity]>;
};

export interface TelemetrySettings {
  handlers?: HandlerConfig<MonitorHandlerType[MonitorType.Telemetry]>;
  cpu?: string;
  minMemoryGB?: number;
  minCores?: number;
  clientVersion?: Partial<Record<PolkadotClientImpl, string>>;
  provider?: string;
  sanctionedCountries?: string[];
  sanctionedRegions?: string[];
}

export type MonitorTypeSettings = {
  [MonitorType.Staking]: StakingSettings;
  [MonitorType.Governance]: GovernanceSettings;
  [MonitorType.Balances]: BalancesSettings;
  [MonitorType.Identity]: IdentitySettings;
  [MonitorType.Telemetry]: TelemetrySettings;
};

export type MonitorSettings<T extends MonitorType> = MonitorTypeSettings[T];

export interface MonitoringGroup {
  name: string;
  chain: Chain;
  monitors: MonitorConfig[];
  accounts: ConfigAccountSettings[];
  alerts: AlertSettings;
  // TODO: Remove or redesign, this key doesn't belong to monitoring
  enablePayout?: boolean;
}

export interface MonitorConfig {
  name: MonitorType;
  settings?: MonitorTypeSettings[MonitorType];
}
