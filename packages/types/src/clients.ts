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

export interface KeyValueStorageClient {
  set(key: string, value: any): Promise<void>;
  setex(key: string, seconds: number, value: any): Promise<void>;
  get<T>(key: string): Promise<T | null>;
  del(key: string): Promise<void>;
  keys(pattern: string): Promise<string[]>;
}

export interface PersistentStorageClient {
  getLastProcessedBlock(): Promise<number | null>;
  setLastProcessedBlock(block: number): Promise<void>;
  getOngoingIncident(incidentId: string): Promise<ActiveIncidentState | null>;
  setOngoingIncident(incidentId: string, state: ActiveIncidentState): Promise<void>;
  deleteOngoingIncident(incidentId: string): Promise<void>;
}

export interface DataStoreClient extends PersistentStorageClient, KeyValueStorageClient {
  clearAll(): Promise<void>;
}
