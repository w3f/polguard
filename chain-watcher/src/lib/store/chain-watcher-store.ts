import { DataStoreClient, ActiveIncidentState, KeyValueStorageClient } from '../interfaces';
import { Logger } from '../interfaces';

/**
 * ChainWatcherStore acts as an abstraction layer over the Redis client, providing type-safe methods
 * for storing and retrieving data specific to the Chain Watcher's needs.
 */
export class ChainWatcherStore implements DataStoreClient {
  private static instance: ChainWatcherStore;
  private readonly KEY_PREFIX = 'chain_watcher:';
  private readonly KEYS = {
    INCIDENT: 'incident',
    LAST_PROCESSED_BLOCK: 'last_processed_block',
  };

  private constructor(
    private client: KeyValueStorageClient,
    private logger: Logger,
  ) {}

  public static getInstance(client: KeyValueStorageClient, logger: Logger): DataStoreClient {
    if (!ChainWatcherStore.instance) {
      ChainWatcherStore.instance = new ChainWatcherStore(client, logger);
    }
    return ChainWatcherStore.instance;
  }

  // KeyValueStorageClient methods
  async get<T>(key: string): Promise<T | null> {
    return this.client.get<T>(key);
  }
  set = this.client.set.bind(this.client);
  setex = this.client.setex.bind(this.client);
  del = this.client.del.bind(this.client);
  keys = this.client.keys.bind(this.client);

  // PersistentStorage methods
  async getLastProcessedBlock(): Promise<number | null> {
    return this.get<number>(this.KEYS.LAST_PROCESSED_BLOCK);
  }

  async setLastProcessedBlock(block: number): Promise<void> {
    await this.set(this.KEYS.LAST_PROCESSED_BLOCK, block);
  }

  async getOngoingIncident(incidentId: string): Promise<ActiveIncidentState | null> {
    return this.get<ActiveIncidentState>(`${this.KEYS.INCIDENT}:${incidentId}`);
  }

  async setOngoingIncident(incidentId: string, state: ActiveIncidentState): Promise<void> {
    await this.set(`${this.KEYS.INCIDENT}:${incidentId}`, state);
  }

  async deleteOngoingIncident(incidentId: string): Promise<void> {
    await this.del(`${this.KEYS.INCIDENT}:${incidentId}`);
  }

  public async clearAll(): Promise<void> {
    try {
      const keys = await this.client.keys(`${this.KEY_PREFIX}*`);
      if (keys.length > 0) {
        await Promise.all(keys.map(key => this.client.del(key)));
      }
    } catch (error) {
      this.logger.error(`Failed to clear all keys: ${error.message}`);
      throw error;
    }
  }
}
