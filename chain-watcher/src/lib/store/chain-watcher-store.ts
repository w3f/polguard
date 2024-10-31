import { IncidentEvent, StorageClient } from '../interfaces';

/**
 * ChainWatcherStore is responsible for managing persistent storage and event emission
 * for the Chain Watcher system. It uses Redis for data storage and pub/sub functionality.
 * 
 * This class provides methods to:
 * - Store and retrieve account balances
 * - Store and retrieve validator active sets
 * - Store and retrieve the current era
 * - Track the last processed block
 * - Manage active incidents
 * 
 * It acts as an abstraction layer over the Redis client, providing type-safe methods
 * for storing and retrieving data specific to the Chain Watcher's needs.
 */
export class ChainWatcherStore {
  private readonly KEYS = {
    INCIDENT: 'incident',
    ACCOUNT_BALANCES: 'account_balances',
    VALIDATOR_ACTIVE_SET: 'validator_active_set',
    LAST_PROCESSED_BLOCK: 'last_processed_block',
    CURRENT_ERA: 'current_era',
  };

  constructor(private storageClient: StorageClient) {}

  private async set<T>(key: string, data: T, ttl?: number): Promise<void> {
    const serializedData = JSON.stringify(data);
    if (ttl) {
      await this.storageClient.setex(key, ttl, serializedData);
    } else {
      await this.storageClient.set(key, serializedData);
    }
  }

  private async get<T>(key: string): Promise<T | null> {
    const value = await this.storageClient.get(key);
    return value ? JSON.parse(value) : null;
  }

  private async delete(key: string): Promise<void> {
    await this.storageClient.del(key);
  }

  async getAccountBalances(block: number): Promise<Map<string, bigint>> {
    const key = `${this.KEYS.ACCOUNT_BALANCES}:${block}`;
    const data = await this.get<Record<string, string>>(key);
    return new Map(
      Object.entries(data || {}).map(([account, balance]) => [account, BigInt(balance)])
    );
  }

  async setAccountBalances(block: number, balances: Map<string, bigint>, ttl: number = 300): Promise<void> {
    const key = `${this.KEYS.ACCOUNT_BALANCES}:${block}`;
    const data = Object.fromEntries(
      Array.from(balances, ([account, balance]) => [account, balance.toString()])
    );
    await this.set(key, data, ttl);
  }

  async getEraValidators(era: number): Promise<Set<string> | null> {
    const key = `${this.KEYS.VALIDATOR_ACTIVE_SET}:${era}`;
    const validatorsArray = await this.get<string[]>(key);
    const result = Array.isArray(validatorsArray) ? new Set(validatorsArray) : null;
    return result
  }

  async setEraValidators(era: number, validators: Set<string>, ttl: number = 2592000): Promise<void> {
    const key = `${this.KEYS.VALIDATOR_ACTIVE_SET}:${era}`;
    await this.set(key, Array.from(validators), ttl);
  }

  async getLastProcessedBlock(): Promise<number | null> {
    return this.get<number>(this.KEYS.LAST_PROCESSED_BLOCK);
  }

  async setLastProcessedBlock(block: number): Promise<void> {
    await this.set(this.KEYS.LAST_PROCESSED_BLOCK, block);
  }

  async getCurrentEra(): Promise<number | null> {
    return this.get<number>(this.KEYS.CURRENT_ERA);
  }

  async setCurrentEra(era: number): Promise<void> {
    await this.set(this.KEYS.CURRENT_ERA, era);
  }

  async getOngoingIncident(incidentId: string): Promise<ActiveIncidentState | null> {
    return this.get<ActiveIncidentState>(`${this.KEYS.INCIDENT}:${incidentId}`);
  }

  async setOngoingIncident(incidentId: string, state: ActiveIncidentState): Promise<void> {
    await this.set(`${this.KEYS.INCIDENT}:${incidentId}`, state);
  }

  async deleteOngoingIncident(incidentId: string): Promise<void> {
    await this.delete(`${this.KEYS.INCIDENT}:${incidentId}`);
  }
}

interface ActiveIncidentState {
  incident: IncidentEvent;
  consecutiveFiringBlocks: number;
  consecutiveNormalBlocks: number;
  lastEmitted: number;
}
