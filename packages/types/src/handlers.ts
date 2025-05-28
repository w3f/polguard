import { EventRecord } from '@polkadot/types/interfaces/system';
import { CallBase } from '@polkadot/types/types/calls';
import { AnyTuple } from '@polkadot/types/types';
import { AssetsHandlerType, BalancesHandlerType, GovernanceHandlerType, IdentityHandlerType, MonitorType, StakingHandlerType, XcmHandlerType } from './constants';

export type HandlerFunction<T> = (params: T) => Promise<void>;
export type EventHandlerFunction = HandlerFunction<EventHandlerParams>;
export type CallHandlerFunction = HandlerFunction<CallHandlerParams>;
export type StateHandlerFunction = HandlerFunction<StateHandlerParams>;

export interface CallHandlerParams<T extends HandlerType = HandlerType> {
  call: CallBase<AnyTuple>;
  origin: string;
  blockNumber: number;
  extrinsicIndex: number;
  handlerType?: T;
}

export interface EventHandlerParams<T extends HandlerType = HandlerType> {
  eventRecord: EventRecord;
  blockNumber: number;
  handlerType?: T;
}

export interface StateHandlerParams<T extends HandlerType = HandlerType> {
  blockNumber: number;
  handlerType?: T;
}

export type MonitorHandlerType = {
  [MonitorType.Balances]: BalancesHandlerType;
  [MonitorType.Identity]: IdentityHandlerType;
  [MonitorType.Staking]: StakingHandlerType;
  [MonitorType.Governance]: GovernanceHandlerType;
  [MonitorType.Xcm]: XcmHandlerType;
  [MonitorType.Assets]: AssetsHandlerType;
};

export type HandlerType =
  | StakingHandlerType
  | BalancesHandlerType
  | GovernanceHandlerType
  | IdentityHandlerType
  | XcmHandlerType
  | AssetsHandlerType;
