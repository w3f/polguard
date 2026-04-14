import { ChainDataProvider } from './data-provider';
import { CallHandlerParams, EventHandlerParams, StateHandlerParams } from './handlers';
import { IncidentHandlerClient } from './incident';
import { Logger, ChainProperties, MonitorType, MonitoringGroup, MonitorTypeSettings, AccountId } from '../types';

export interface Monitor {
  processState(params: StateHandlerParams): Promise<void>;
  processEvent(params: EventHandlerParams): Promise<void>;
  processCall(params: CallHandlerParams): Promise<void>;
}

export type MonitorConstructor<T extends MonitorType> = new (
  logger: Logger,
  groups: MonitoringGroup[],
  incidents: IncidentHandlerClient,
  chainProps: ChainProperties,
  provider: ChainDataProvider,
  monitorType: T,
) => Monitor;

export type MonitorSettings<T extends MonitorType> = MonitorTypeSettings[T];

export interface AccountSettings<T extends MonitorType> extends AccountId {
  settings: MonitorSettings<T>;
}
