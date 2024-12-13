import { Chain } from '@lib/constants';
import { DataStoreClient, ActiveIncidentState, KeyValueStorageClient } from '../interfaces';
import { Logger } from '../interfaces';

/**
 * ChainWatcherStore acts as an abstraction layer over the Redis client, providing type-safe methods
 * for storing and retrieving data specific to the Chain Watcher's needs.
 */
export class ChainWatcherStore implements DataStoreClient {
  private static instance: ChainWatcherStore;
  private readonly KEYS = {
    INCIDENT: 'inc',
    LAST_PROCESSED_BLOCK: 'last_processed_block',
  };

  private constructor(
    private client: KeyValueStorageClient,
    private chain: Chain,
    private logger: Logger,
  ) {}

  public static getInstance(client: KeyValueStorageClient, chain: Chain, logger: Logger): DataStoreClient {
    if (!ChainWatcherStore.instance) {
      ChainWatcherStore.instance = new ChainWatcherStore(client, chain, logger);
    }
    return ChainWatcherStore.instance;
  }

  // KeyValueStorageClient methods
  async get<T>(key: string): Promise<T | null> {
    return this.client.get<T>(`${this.chain}:${key}`);
  }

  async set(key: string, value: any): Promise<void> {
    await this.client.set(`${this.chain}:${key}`, value);
  }

  async setex(key: string, seconds: number, value: any): Promise<void> {
    await this.client.setex(`${this.chain}:${key}`, seconds, value);
  }

  async del(key: string): Promise<void> {
    await this.client.del(`${this.chain}:${key}`);
  }

  async keys(pattern: string): Promise<string[]> {
    return this.client.keys(`${this.chain}:${pattern}`);
  }

  // PersistentStorage methods
  async getLastProcessedBlock(): Promise<number | null> {
    return this.get<number>(`${this.KEYS.LAST_PROCESSED_BLOCK}`);
  }

  async setLastProcessedBlock(block: number): Promise<void> {
    await this.set(`${this.KEYS.LAST_PROCESSED_BLOCK}`, block);
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
      const keys = await this.client.keys(`${this.chain}*`);
      if (keys.length > 0) {
        await Promise.all(keys.map(key => this.client.del(key)));
      }
    } catch (error) {
      this.logger.error(`Failed to clear all keys: ${error.message}`);
      throw error;
    }
  }
}
