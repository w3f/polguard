/**
 * This module defines interfaces for external client dependencies used in the Watchers.
 * These interfaces abstract the implementation details of various external services.
 *
 * - EventEmitterClient: Represents a client for emitting events (e.g., Redis Streams)
 * - MetricsClient: Represents a client for recording metrics (e.g., Prometheus)
 * - KeyValueStorageClient: Represents a client for caching and storing data (e.g., Redis)
 * - IncidentApiClient: Represents a client for sending incidents to the incident management service
 * - MonitoringConfigClient: Represents a client for fetching monitoring configuration
 */

import { CreateIncidentDto, ResolveIncidentByChainDto } from './incident';
import { MonitoringGroup } from './monitor';
import { Hash, Header, SignedBlock } from '@polkadot/types/interfaces';
import { ApiDecoration } from '@polkadot/api/types';
import { Chain } from './constants';

export interface MonitoringConfigClient {
  getMonitoringGroups(): Promise<MonitoringGroup[]>;
}

export interface EventEmitterClient {
  emit(event: string, payload: any): Promise<boolean>;
}

export interface MetricsClient {
  setBlockHeight?(height: number): void;
  setMonitoredAccountsCount(count: number): void;
  setMonitorsCount(count: number): void;
  setMonitorGroupsCount(count: number): void;
}

/** Base interface for key-value storage operations */
export interface KeyValueStorageClient {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: any): Promise<void>;
  setex(key: string, seconds: number, value: any): Promise<void>;
  del(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}


/** Client for sending incidents to the incident management service */
export interface IncidentApiClient {
  createIncident(incident: CreateIncidentDto): Promise<string | null>; // Returns incident ID or null for 409 conflicts
  resolveIncident(id: number, resolveData: ResolveIncidentByChainDto): Promise<void>;
}

/** Client for managing last processed block information */
export interface LastBlockClient {
  getLastBlock(chain: Chain): Promise<number | null>;
  setLastBlock(chain: Chain, blockNumber: number): Promise<void>;
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
    }
  };
  
  at(blockHash: Hash): Promise<ApiDecoration<"promise">>;
}
