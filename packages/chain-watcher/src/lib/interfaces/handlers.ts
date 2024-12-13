import { EventRecord } from '@polkadot/types/interfaces/system';
import { CallBase } from '@polkadot/types/types/calls';
import { AnyTuple } from '@polkadot/types/types';

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
