import { EventRecord } from '@polkadot/types/interfaces/system';
import { CallBase } from '@polkadot/types/types/calls';
import { AnyTuple } from '@polkadot/types/types';
import { BalancesHandlerType, GovernanceHandlerType, IdentityHandlerType, MonitorType, StakingHandlerType, TelemetryHandlerType } from './constants';
import { NodeInfo } from './telemetry';

export type HandlerFunction<T> = (params: T) => Promise<void>;
export type EventHandlerFunction = HandlerFunction<EventHandlerParams>;
export type CallHandlerFunction = HandlerFunction<CallHandlerParams>;
export type BlockHandlerFunction = HandlerFunction<EveryBlockHandlerParams>;
export type TelemetryHandlerFunction = HandlerFunction<TelemetryHandlerParams>;

export interface TelemetryHandlerParams {
  data: Record<string, NodeInfo[]>;
}

export interface CallHandlerParams {
  call: CallBase<AnyTuple>;
  origin: string;
  blockNumber: number;
  extrinsicIndex: number;
}

export interface EventHandlerParams {
  eventRecord: EventRecord;
  blockNumber: number;
}

export interface EveryBlockHandlerParams {
  blockNumber: number;
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
