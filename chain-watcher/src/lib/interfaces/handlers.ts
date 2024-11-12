import { BlockHash } from '@polkadot/types/interfaces';
import { EventRecord } from '@polkadot/types/interfaces/system';
import { CallBase } from '@polkadot/types/types/calls';
import { AnyTuple } from '@polkadot/types/types';

export interface CallHandlerParams {
  call: CallBase<AnyTuple>;
  origin: string;
  blockHash: BlockHash;
  blockNumber: number;
  extrinsicIndex: number;
}

export interface EventHandlerParams {
  eventRecord: EventRecord;
  blockHash: BlockHash;
  blockNumber: number;
}

export interface EveryBlockHandlerParams {
  blockHash: BlockHash;
  blockNumber: number;
}
