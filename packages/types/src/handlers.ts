import { EventRecord } from '@polkadot/types/interfaces/system';
import { CallBase } from '@polkadot/types/types/calls';
import { AnyTuple } from '@polkadot/types/types';
import { BalancesHandlerType, GovernanceHandlerType, IdentityHandlerType, MonitorType, StakingHandlerType, TelemetryHandlerType } from './constants';
import { NodeInfo } from './telemetry';

export type HandlerFunction<T> = (params: T) => Promise<void>;
export type EventHandlerFunction = HandlerFunction<EventHandlerParams>;
export type CallHandlerFunction = HandlerFunction<CallHandlerParams>;
export type StateHandlerFunction = HandlerFunction<StateHandlerParams>;
export type TelemetryHandlerFunction = HandlerFunction<TelemetryHandlerParams>;

export interface TelemetryHandlerParams<T extends HandlerType = HandlerType> {
  data: Record<string, NodeInfo[]>;
  handler?: T;
}

export interface CallHandlerParams<T extends HandlerType = HandlerType> {
  call: CallBase<AnyTuple>;
  origin: string;
  blockNumber: number;
  extrinsicIndex: number;
  handler?: T;
}

export interface EventHandlerParams<T extends HandlerType = HandlerType> {
  eventRecord: EventRecord;
  blockNumber: number;
  handler?: T;
}

export interface StateHandlerParams<T extends HandlerType = HandlerType> {
  blockNumber: number;
  handler?: T;
}

export type MonitorHandlerType = {
  [MonitorType.Balances]: BalancesHandlerType;
  [MonitorType.Identity]: IdentityHandlerType;
  [MonitorType.Staking]: StakingHandlerType;
  [MonitorType.Governance]: GovernanceHandlerType;
  [MonitorType.Telemetry]: TelemetryHandlerType;
};

export type HandlerType = 
  | StakingHandlerType 
  | BalancesHandlerType 
  | GovernanceHandlerType 
  | IdentityHandlerType
  | TelemetryHandlerType;

export type HandlerExecutionType = 'triggered' | 'periodic';
