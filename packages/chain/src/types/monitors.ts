import { ChainDataProvider } from './data-provider';
import { CallHandlerParams, StateHandlerParams, SystemEvent } from './handlers';
import { BlockContext, IncidentHandlerClient } from './incident';
import { AppLogger, ChainProperties, MonitorType, MonitoringGroup, MonitorTypeSettings, AccountId } from '../types';

export interface Monitor {
  processState(params: StateHandlerParams): Promise<void>;
  processEvent(systemEvent: SystemEvent, blockContext: BlockContext): Promise<void>;
  processCall(params: CallHandlerParams): Promise<void>;
}

export type MonitorConstructor<T extends MonitorType> = new (
  logger: AppLogger,
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
