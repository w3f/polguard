import { KeyValueStorageClient } from '@w3f/monitoring-types';

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
 * const chainStore = new Store(redisClient, 'polkadot');
 * await chainStore.set('last_processed_block', 12345);
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
export class Store implements KeyValueStorageClient {
  constructor(
    private client: KeyValueStorageClient,
    private namespace: string,
  ) {}

  async get<T>(key: string): Promise<T | null> {
    return this.client.get<T>(`${this.namespace}:${key}`);
  }

  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    if (keys.length === 0) return [];
    return this.client.mget<T>(keys);
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

  async exists(key: string): Promise<boolean> {
    return this.client.exists(`${this.namespace}:${key}`);
  }

  async keys(pattern: string): Promise<string[]> {
    return this.client.keys(`${this.namespace}:${pattern}`);
  }
}
