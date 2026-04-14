import { MonitoringGroup, Chain } from '../types';
import { Hash, Header, SignedBlock } from '@polkadot/types/interfaces';
import { ApiDecoration } from '@polkadot/api/types';

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

/**
 * Interface for chain API operations required by the ChainWatcher.
 * This decouples the watcher from the specific ApiPromise implementation.
 */
export interface ChainApiClient {
  rpc: {
    chain: {
      getHeader(): Promise<Header>;
      getBlockHash(blockNumber: number): Promise<Hash>;
      getBlock(blockHash: Hash): Promise<SignedBlock>;
      subscribeFinalizedHeads(callback: (header: Header) => void): void;
    };
  };

  at(blockHash: Hash): Promise<ApiDecoration<'promise'>>;
}

export interface ChainTelemetryClient {
  recordLatestBlock(blockNumber: number): void;
  recordProcessedBlock(blockNumber: number): void;
  recordCurrentBlock(blockNumber: number): void;
  recordProcessingTime(ms: number): void;
  recordMonitoringConfig(groups: MonitoringGroup[]): void;
}

export interface MonitoringConfigClient {
  getMonitoringGroups(): Promise<MonitoringGroup[]>;
}
