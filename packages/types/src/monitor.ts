import { Logger, StateQueryProvider } from './utils';
import { ChainProperties } from './chain';
import { Chain, ComparisonType, MonitorType } from './constants';
import { AlertSettings, IncidentHandlerClient } from './incident';
import { ConfigAccountSettings } from './account';
import { CallHandlerParams, EventHandlerParams, EveryBlockHandlerParams } from './handlers';

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

export interface ValidatorSettings {
  commission: number;
  commissionComparison: ComparisonType;
  payee?: string;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface GovernanceSettings {
  // TODO: Implement governance-specific settings
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface TransactionSettings {
  // TODO: Implement transaction-specific settings
}

export interface BalanceSettings {
  balanceThreshold?: bigint;
}

export type MonitorTypeSettings = {
  [MonitorType.Validator]: ValidatorSettings;
  [MonitorType.Governance]: GovernanceSettings;
  [MonitorType.TransactionIngress]: TransactionSettings;
  [MonitorType.TransactionEgress]: TransactionSettings;
  [MonitorType.BalanceIncrement]: BalanceSettings;
  [MonitorType.BalanceDecrement]: BalanceSettings;
  [MonitorType.BalanceThreshold]: BalanceSettings;
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
