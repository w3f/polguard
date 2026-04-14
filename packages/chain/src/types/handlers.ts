import {
  AssetsHandlerType,
  BalancesHandlerType,
  GovernanceHandlerType,
  IdentityHandlerType,
  StakingHandlerType,
  XcmHandlerType,
} from '../types';
import { EventRecord } from '@polkadot/types/interfaces/system';
import { CallBase } from '@polkadot/types/types/calls';
import { AnyTuple } from '@polkadot/types/types';
import { BlockContext } from './incident';

export type HandlerFunction<T> = (params: T) => Promise<void>;
export type EventHandlerFunction = HandlerFunction<EventHandlerParams>;
export type CallHandlerFunction = HandlerFunction<CallHandlerParams>;
export type StateHandlerFunction = HandlerFunction<StateHandlerParams>;

export interface CallHandlerParams<T extends HandlerType = HandlerType> {
  call: CallBase<AnyTuple>;
  origin: string;
  blockContext: BlockContext;
  handlerType?: T;
}

export interface EventHandlerParams<T extends HandlerType = HandlerType> {
  eventRecord: EventRecord;
  blockContext: BlockContext;
  handlerType?: T;
}

export interface StateHandlerParams<T extends HandlerType = HandlerType> {
  blockContext: BlockContext;
  handlerType?: T;
}

export type HandlerType =
  | StakingHandlerType
  | BalancesHandlerType
  | GovernanceHandlerType
  | IdentityHandlerType
  | XcmHandlerType
  | AssetsHandlerType;
