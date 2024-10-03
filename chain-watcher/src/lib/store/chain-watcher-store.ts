import { IncidentEvent, StorageClient } from '../interfaces';

/**
 * ChainWatcherStore is responsible for managing persistent storage and event emission
 * for the Chain Watcher system. It uses Redis for data storage and pub/sub functionality.
 * 
 * This class provides methods to:
 * - Store and retrieve account balances (with a 5-minute TTL)
 * - Track the last processed block
 * - Manage active incidents
 * 
 * It acts as an abstraction layer over the Redis client, providing type-safe methods
 * for storing and retrieving data specific to the Chain Watcher's needs.
 */
export class ChainWatcherStore {
  private readonly INCIDENT_PREFIX = 'incident:';
  private readonly ACCOUNT_BALANCES_PREFIX = 'account_balances:';
  private readonly LAST_PROCESSED_BLOCK_KEY = 'last_processed_block';
  private readonly ACCOUNT_BALANCES_TTL = 300; // 5 minutes

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
    const key = `${this.ACCOUNT_BALANCES_PREFIX}${block}`;
    const data = await this.get<Record<string, string>>(key);
    return new Map(
      Object.entries(data || {}).map(([account, balance]) => [account, BigInt(balance)])
    );
  }

  async setAccountBalances(block: number, balances: Map<string, bigint>): Promise<void> {
    const key = `${this.ACCOUNT_BALANCES_PREFIX}${block}`;
    const data = Object.fromEntries(
      Array.from(balances, ([account, balance]) => [account, balance.toString()])
    );
    await this.set(key, data, this.ACCOUNT_BALANCES_TTL);
  }

  async getLastProcessedBlock(): Promise<number | null> {
    return this.get<number>(this.LAST_PROCESSED_BLOCK_KEY);
  }

  async setLastProcessedBlock(block: number): Promise<void> {
    await this.set(this.LAST_PROCESSED_BLOCK_KEY, block);
  }

  async getOngoingIncident(incidentId: string): Promise<ActiveIncidentState | null> {
    return this.get<ActiveIncidentState>(`${this.INCIDENT_PREFIX}${incidentId}`);
  }

  async setOngoingIncident(incidentId: string, state: ActiveIncidentState): Promise<void> {
    await this.set(`${this.INCIDENT_PREFIX}${incidentId}`, state);
  }

  async deleteOngoingIncident(incidentId: string): Promise<void> {
    await this.delete(`${this.INCIDENT_PREFIX}${incidentId}`);
  }
}

interface ActiveIncidentState {
  incident: IncidentEvent;
  consecutiveFiringBlocks: number;
  consecutiveNormalBlocks: number;
  lastEmitted: number;
}
