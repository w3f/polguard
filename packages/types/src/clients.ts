/**
 * This module defines interfaces for external client dependencies used in the Watchers.
 * These interfaces abstract the implementation details of various external services.
 *
 * - EventEmitterClient: Represents a client for emitting events (e.g., Redis Streams)
 * - MetricsClient: Represents a client for recording metrics (e.g., Prometheus)
 * - KeyValueStorageClient: Represents a client for caching and storing data (e.g., Redis)
 * - TelemetryClient: Represents a client for fetching telemetry data from nodes
 * - IncidentApiClient: Represents a client for sending incidents to the incident management service
 */

import { TelemetryData } from './telemetry';
import { CreateIncidentDto, ResolveIncidentDto } from './incident';

export interface TelemetryClient {
  getTelemetry(): Promise<TelemetryData>;
}

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
  exists(key: string): Promise<boolean>;
  keys(pattern: string): Promise<string[]>;
  mget<T>(keys: string[]): Promise<(T | null)[]>;
}

/** Main data store interface combining key-value operations with specific monitoring functionality */
export interface DataStoreClient extends KeyValueStorageClient {
  // Processing state management
  getLastProcessed(key: string): Promise<number | null>;
  setLastProcessed(key: string, value: number): Promise<void>;

  // Utility methods
  clearAll(): Promise<void>;
}

/** Client for sending incidents to the incident management service */
export interface IncidentApiClient {
  createIncident(incident: CreateIncidentDto): Promise<boolean>;
  resolveIncident(resolveData: ResolveIncidentDto): Promise<boolean>;
}
