import { DataStoreClient, ActiveIncidentState, KeyValueStorageClient, Logger } from '@w3f/monitoring-types';

/**
 * Store provides a namespaced key-value storage layer for the monitoring platform.
 * It implements both persistent storage and caching operations.
 *
 * Key features:
 * 1. Namespaced storage - all keys are prefixed with a namespace (e.g., 'polkadot', 'kusama_telemetry')
 * 2. Persistent storage
 *    - Incident state management
 *    - Processing state tracking (blocks, timestamps)
 * 3. Caching layer
 *    - Temporary storage with expiration (setex)
 *    - Used by Cache decorator for method results
 *
 * Example usage:
 * ```typescript
 * // Persistent storage
 * const chainStore = new Store(redisClient, 'polkadot', logger);
 * await chainStore.setLastProcessed('block', 12345);
 *
 * // Caching
 * class ExampleService {
 *   @Cache('validators', 60)  // Cache for 60 seconds
 *   async getValidators(): Promise<string[]> {
 *     // ... expensive operation
 *   }
 * }
 * ```
 */
export class Store implements DataStoreClient {
  constructor(
    private client: KeyValueStorageClient,
    private namespace: string,
    private logger: Logger,
  ) {}

  async get<T>(key: string): Promise<T | null> {
    return this.client.get<T>(`${this.namespace}:${key}`);
  }

  async set(key: string, value: any): Promise<void> {
    await this.client.set(`${this.namespace}:${key}`, value);
  }

  async setex(key: string, seconds: number, value: any): Promise<void> {
    await this.client.setex(`${this.namespace}:${key}`, seconds, value);
  }

  async del(key: string): Promise<void> {
    await this.client.del(`${this.namespace}:${key}`);
  }

  async keys(pattern: string): Promise<string[]> {
    return this.client.keys(`${this.namespace}:${pattern}`);
  }

  async getOngoingIncident(incidentId: string): Promise<ActiveIncidentState | null> {
    return this.get<ActiveIncidentState>(`inc:${incidentId}`);
  }

  async setOngoingIncident(incidentId: string, state: ActiveIncidentState): Promise<void> {
    await this.set(`inc:${incidentId}`, state);
  }

  async deleteOngoingIncident(incidentId: string): Promise<void> {
    await this.del(`inc:${incidentId}`);
  }

  async getLastProcessed(key: string): Promise<number | null> {
    return this.get<number>(`last_processed_${key}`);
  }

  async setLastProcessed(key: string, value: number): Promise<void> {
    await this.set(`last_processed_${key}`, value);
  }

  /**
   * Clears all keys in the current namespace
   * @throws Error if deletion fails
   */
  public async clearAll(): Promise<void> {
    try {
      const keys = await this.client.keys(`${this.namespace}*`);
      if (keys.length > 0) {
        await Promise.all(keys.map(key => this.client.del(key)));
      }
    } catch (error) {
      this.logger.error(`Failed to clear all keys: ${error.message}`);
      throw error;
    }
  }
}
