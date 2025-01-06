import { EventRecord } from '@polkadot/types/interfaces/system';
import { CallBase } from '@polkadot/types/types/calls';
import { AnyTuple } from '@polkadot/types/types';
import { BalancesHandlerType, GovernanceHandlerType, IdentityHandlerType, MonitorType, StakingHandlerType } from './constants';

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
};

export type HandlerType = 
  | StakingHandlerType 
  | BalancesHandlerType 
  | GovernanceHandlerType 
  | IdentityHandlerType;