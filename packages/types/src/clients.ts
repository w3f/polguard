/**
 * This module defines interfaces for external client dependencies used in the ChainWatcher.
 * These interfaces abstract the implementation details of various external services.
 *
 * - EventEmitterClient: Represents a client for emitting events (e.g., Redis Streams)
 * - MetricsClient: Represents a client for recording metrics (e.g., Prometheus)
 * - KeyValueStorageClient: Represents a client for caching and storing data (e.g., Redis)
 *
 */

import { ActiveIncidentState } from './incident';

export interface EventEmitterClient {
  emit(event: string, payload: any): Promise<boolean>;
}

export interface MetricsClient {
  setBlockHeight(height: number): void;
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
  keys(pattern: string): Promise<string[]>;
}

/** Main data store interface combining key-value operations with specific monitoring functionality */
export interface DataStoreClient extends KeyValueStorageClient {
  // Incident management
  getOngoingIncident(incidentId: string): Promise<ActiveIncidentState | null>;
  setOngoingIncident(incidentId: string, state: ActiveIncidentState): Promise<void>;
  deleteOngoingIncident(incidentId: string): Promise<void>;

  // Processing state management
  getLastProcessed(key: string): Promise<number | null>;
  setLastProcessed(key: string, value: number): Promise<void>;

  // Utility methods
  clearAll(): Promise<void>;
}
