import {
  AssetsHandlerType,
  BalancesHandlerType,
  GovernanceHandlerType,
  IdentityHandlerType,
  StakingHandlerType,
  XcmHandlerType,
} from '../types';
import { BlockContext } from './incident';

export type EventPhase =
  | { type: 'ApplyExtrinsic'; value: number }
  | { type: 'Finalization' }
  | { type: 'Initialization' };

export type SystemEvent = {
  phase: EventPhase;
  event: {
    type: string;
    value: {
      type: string;
      value: any;
    };
  };
  topics: string[];
};

export type HandlerFunction<T> = (params: T) => Promise<void>;
export type EventHandlerFunction = HandlerFunction<EventHandlerParams>;
export type CallHandlerFunction = HandlerFunction<CallHandlerParams>;
export type StateHandlerFunction = HandlerFunction<StateHandlerParams>;

/**
 * PAPI decoded call structure.
 * Represents the result of txFromCallData(...).decodedCall
 *
 * Example: { type: "Balances", value: { type: "transfer_keep_alive", value: { dest: ..., value: ... } } }
 */
export type DecodedCall = {
  type: string; // PascalCase pallet name, e.g. "Balances", "Proxy", "Utility"
  value: {
    type: string; // snake_case method name, e.g. "transfer_keep_alive", "proxy", "batch"
    value: Record<string, any>; // Named arguments
  };
};

export interface CallHandlerParams<T extends HandlerType = HandlerType> {
  call: DecodedCall;
  origin: string;
  blockContext: BlockContext;
  handlerType?: T;
}

export interface EventHandlerParams<T extends HandlerType = HandlerType> {
  payload: any; // Typed payload from PAPI event
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
