import { ChainProperties, ConfigAccountSettings, Logger, IdentityField } from '.';
import { Chain, ComparisonType, MonitorType } from './constants';
import { AlertSettings, IncidentHandlerClient } from './incident';
import { CallHandlerParams, EventHandlerParams, EveryBlockHandlerParams, MonitorHandlerType } from './handlers';
import { StateQueryProvider } from './state-provider';

export interface Monitor {
  processEveryBlock(params: EveryBlockHandlerParams): Promise<void>;
  processEvent(params: EventHandlerParams): Promise<void>;
  processCall(params: CallHandlerParams): Promise<void>;
}

export interface MonitorConstructor {
  new (
    logger: Logger,
    groups: MonitoringGroup[],
    incidentHandler: IncidentHandlerClient,
    stateQuery: StateQueryProvider,
    chainProperties: ChainProperties,
    monitorType: MonitorType,
  ): Monitor;
}

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

export type MonitorTypeSettings = {
  [MonitorType.Staking]: StakingSettings;
  [MonitorType.Governance]: GovernanceSettings;
  [MonitorType.Balances]: BalancesSettings;
  [MonitorType.Identity]: IdentitySettings;
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
