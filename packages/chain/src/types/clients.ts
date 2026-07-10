import type { Observable } from 'rxjs';
import { MonitoringGroup, Chain } from '../types';
import { DecodedCall } from './handlers';

/**
 * Block-level chain operations.
 * Provides access to block data, finalization tracking, and raw RPC requests.
 */
export interface BlockClient {
  getBlockBody(blockHash: string): Promise<Uint8Array[]>;
  getFinalizedBlock(): Promise<{ number: number; hash: string }>;
  finalizedBlock$: Observable<{ number: number; hash: string }>;
  _request<T, P extends any[]>(method: string, params: P): Promise<T>;
  destroy(): void;
}

/**
 * Runtime-level typed operations (state queries, event queries, call decoding, constants).
 */
export interface RuntimeClient {
  query: any;
  event: any;
  tx: any;
  constants: any;
  txFromCallData: (callData: Uint8Array) => Promise<{ decodedCall: DecodedCall }>;
}

/** Base interface for key-value storage operations */
export interface KeyValueStorageClient {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: any): Promise<void>;
  setex(key: string, seconds: number, value: any): Promise<void>;
  del(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

/**
 * Store: Unified persistence layer interface
 *
 * This interface combines KV storage operations with last block tracking,
 * providing a single abstraction for the chain service's persistence needs.
 */
export interface Store extends KeyValueStorageClient {
  // KV operations inherited from KeyValueStorageClient

  // Last processed block operations
  getLastBlock(chain: Chain): Promise<number | null>;
  setLastBlock(chain: Chain, blockNumber: number): Promise<void>;
}

export interface ChainTelemetryClient {
  recordLatestBlock(blockNumber: number): void;
  recordProcessedBlock(blockNumber: number): void;
  recordCurrentBlock(blockNumber: number): void;
  recordProcessingTime(ms: number): void;
  recordMonitoringConfig(groups: MonitoringGroup[]): void;
}

export interface MonitoringConfigClient {
  getMonitoringGroups(): Promise<{ groups: MonitoringGroup[]; fingerprint: string }>;
}
