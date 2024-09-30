import { RedisClient, IncidentEvent, IncidentResolvedEvent } from '../interfaces';

/**
 * ChainWatcherStore is responsible for managing persistent storage and event emission
 * for the Chain Watcher system. It uses Redis for data storage and pub/sub functionality.
 * 
 * This class provides methods to:
 * - Store and retrieve account balances (with a 5-minute TTL)
 * - Track the last processed block
 * - Manage active incidents
 * - Emit incident events
 * 
 * It acts as an abstraction layer over the Redis client, providing type-safe methods
 * for storing and retrieving data specific to the Chain Watcher's needs.
 */
export class ChainWatcherStore {
  private readonly INCIDENTS_KEY = 'incidents';
  private readonly LAST_PROCESSED_BLOCK_KEY = 'last_processed_block';
  private readonly ACCOUNT_BALANCES_KEY = 'account_balances';
  private readonly INCIDENT_CHANNEL = 'incident_channel';
  private readonly ACCOUNT_BALANCES_TTL = 300; // 5 minutes

  constructor(private redisClient: RedisClient) {}

  private async set<T>(key: string, data: T, ttl?: number): Promise<void> {
    const serializedData = JSON.stringify(data);
    if (ttl) {
      await this.redisClient.setex(key, ttl, serializedData);
    } else {
      await this.redisClient.set(key, serializedData);
    }
  }

  private async get<T>(key: string): Promise<T | null> {
    const value = await this.redisClient.get(key);
    return value ? JSON.parse(value) : null;
  }

  private async delete(key: string): Promise<void> {
    await this.redisClient.del(key);
  }

  async getAccountBalances(block: number): Promise<Map<string, bigint>> {
    const key = `${this.ACCOUNT_BALANCES_KEY}_${block}`;
    const data = await this.get<Record<string, string>>(key);
    return new Map(
      Object.entries(data || {}).map(([account, balance]) => [account, BigInt(balance)])
    );
  }

  async setAccountBalances(block: number, balances: Map<string, bigint>): Promise<void> {
    const key = `${this.ACCOUNT_BALANCES_KEY}_${block}`;
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

  async emitEvent(event: IncidentEvent | IncidentResolvedEvent): Promise<void> {
    await this.redisClient.publish(this.INCIDENT_CHANNEL, JSON.stringify(event));
  }

  async getActiveIncidents(): Promise<Map<string, ActiveIncidentState>> {
    const data = await this.get<Record<string, ActiveIncidentState>>(this.INCIDENTS_KEY);
    return new Map(Object.entries(data || {}));
  }

  async setActiveIncidents(incidents: Map<string, ActiveIncidentState>): Promise<void> {
    await this.set(this.INCIDENTS_KEY, Object.fromEntries(incidents));
  }

  async deleteActiveIncident(incidentId: string): Promise<void> {
    const incidents = await this.getActiveIncidents();
    incidents.delete(incidentId);
    await this.setActiveIncidents(incidents);
  }
}

interface ActiveIncidentState {
  incident: IncidentEvent;
  lastDetected: number;
  resolved: boolean;
  consecutiveNormalBlocks: number;
}
