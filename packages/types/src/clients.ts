/**
 * This module defines interfaces for external client dependencies used in the Watchers.
 * These interfaces abstract the implementation details of various external services.
 *
 * - EventEmitterClient: Represents a client for emitting events (e.g., Redis Streams)
 * - MetricsClient: Represents a client for recording metrics (e.g., Prometheus)
 * - KeyValueStorageClient: Represents a client for caching and storing data (e.g., Redis)
 * - TelemetryClient: Represents a client for fetching telemetry data from nodes
 * - IncidentApiClient: Represents a client for sending incidents to the incident management service
 * - MonitoringConfigClient: Represents a client for fetching monitoring configuration
 */

import { TelemetryData } from './telemetry';
import { CreateIncidentDto } from './incident';
import { MonitoringGroup } from './monitor';
import { Hash, Header, SignedBlock } from '@polkadot/types/interfaces';
import { ApiDecoration } from '@polkadot/api/types';

export interface MonitoringConfigClient {
  getMonitoringGroups(): Promise<MonitoringGroup[]>;
}

export interface TelemetryClient {
  getTelemetry(): Promise<TelemetryData>;
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
  mget<T>(keys: string[]): Promise<(T | null)[]>;
  flush(): Promise<void>; // Added for testing purposes
}


/** Client for sending incidents to the incident management service */
export interface IncidentApiClient {
  createIncident(incident: CreateIncidentDto): Promise<number>; // Returns incident ID
  resolveIncident(id: number): Promise<boolean>;
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
