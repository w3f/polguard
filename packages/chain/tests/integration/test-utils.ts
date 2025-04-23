import { Logger, KeyValueStorageClient, AlertSettings, IncidentHandlerClient, IncidentKey } from '@w3f/monitoring-types';
import { ApiPromise, WsProvider } from '@polkadot/api';
import { Chain } from '@w3f/monitoring-types';

/**
 * Manages blockchain API connections for testing
 */
export class ApiConnectionManager {
  private connections = new Map<Chain, ApiPromise>();
  
  constructor(private rpcEndpoints: Record<Chain, string>) {}
  
  async getApi(chain: Chain): Promise<ApiPromise> {
    if (!this.connections.has(chain)) {
      await this.createConnection(chain);
    }
    
    return this.connections.get(chain);
  }
  
  private async createConnection(chain: Chain): Promise<void> {
    const endpoint = this.rpcEndpoints[chain];
    if (!endpoint) {
      throw new Error(`No RPC endpoint configured for chain: ${chain}`);
    }
    
    console.log(`Connecting to ${chain} at ${endpoint}`);
    const api = await ApiPromise.create({ 
      provider: new WsProvider(endpoint), 
      noInitWarn: true 
    });
    
    await api.isReady;
    this.connections.set(chain, api);
  }
  
  async closeAll(): Promise<void> {
    await Promise.all(
      Array.from(this.connections.entries()).map(([chain, api]) => {
        console.log(`Disconnecting from ${chain}`);
        return api.disconnect();
      })
    );
    
    this.connections.clear();
  }
}

/**
 * Simple console logger adapter for testing
 */
export class LoggerAdapter implements Logger {
  constructor(private console: Console = global.console) {}

  log(message: string, ...args: any[]): void {
    this.console.log(message, ...args);
  }

  error(message: string, ...args: any[]): void {
    this.console.error(message, ...args);
  }

  warn(message: string, ...args: any[]): void {
    this.console.warn(message, ...args);
  }

  debug(message: string, ...args: any[]): void {
    this.console.debug(message, ...args);
  }

  verbose(message: string, ...args: any[]): void {
    this.console.debug(`[VERBOSE] ${message}`, ...args);
  }

  fatal(message: string, ...args: any[]): void {
    this.console.error(`[FATAL] ${message}`, ...args);
  }
}

/**
 * Simple in-memory storage implementation for testing
 */
export class MockKeyValueStorage implements KeyValueStorageClient {
  private storage = new Map<string, any>();
  
  async get<T>(key: string): Promise<T | null> {
    return this.storage.get(key) || null;
  }
  
  async set(key: string, value: any): Promise<void> {
    this.storage.set(key, value);
  }
  
  async setex(key: string, _seconds: number, value: any): Promise<void> {
    this.storage.set(key, value);
  }
  
  async del(key: string): Promise<void> {
    this.storage.delete(key);
  }
  
  async exists(key: string): Promise<boolean> {
    return this.storage.has(key);
  }
  
  async keys(pattern: string): Promise<string[]> {
    return Array.from(this.storage.keys()).filter(k => k.includes(pattern));
  }
  
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    return keys.map(k => this.storage.get(k) || null);
  }
}

/**
 * Test incident handler for tracking created incidents
 */
export class TestIncidentHandler implements IncidentHandlerClient {
  private incidents: Set<string> = new Set();

  async handle(
    message: string[],
    alerts: AlertSettings,
    incidentKey: IncidentKey,
    blockNumber: number,
    isFiring?: boolean
  ): Promise<void> {
    if (isFiring === false) return;
    
    this.incidents.add(this.formatKey(incidentKey));
    console.log(`${colors.cyan}Message: ${message.join('\n')}${colors.reset}`);
  }

  wasIncidentCreated(wallet: string, groupId: string, handler: string): boolean {
    return this.incidents.has(`${wallet}:${groupId}:${handler}`);
  }
  
  private formatKey(incidentKey: IncidentKey): string {
    return `${incidentKey.wallet}:${incidentKey.groupId}:${incidentKey.handler}`;
  }
}

export const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
};