import { Logger, KeyValueStorageClient, NotificationSettings, IncidentHandlerClient, IncidentKey } from '@w3f/monitoring-types';

export class LoggerAdapter implements Logger {
  constructor(
    private console: Console = global.console,
    private debugMode: boolean = false
  ) {}

  log(message: string, ...args: any[]): void {
    if (this.debugMode || message.includes('Error') || message.includes('error')) {
      this.console.log(message, ...args);
    }
  }

  error(message: string, ...args: any[]): void {
    this.console.error(message, ...args);
  }

  warn(message: string, ...args: any[]): void {
    if (this.debugMode) this.console.warn(message, ...args);
  }
  
  debug(message: string, ...args: any[]): void {
    if (this.debugMode) this.console.debug(message, ...args);
  }
  
  verbose(message: string, ...args: any[]): void {
    if (this.debugMode) this.console.debug(`[VERBOSE] ${message}`, ...args);
  }
  
  fatal(message: string, ...args: any[]): void {
    this.console.error(`[FATAL] ${message}`, ...args);
  }
}

export class InMemoryKeyValueStorage implements KeyValueStorageClient {
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
  
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    return keys.map(k => this.storage.get(k) || null);
  }
  
  async flush(): Promise<void> {
    this.storage.clear();
  }
}

export class TestIncidentHandler implements IncidentHandlerClient {
  private incidents: Set<string> = new Set();
  
  constructor(private testId?: string) {}

  async handle(
    message: string[],
    notifications: NotificationSettings,
    incidentKey: IncidentKey,
    blockNumber: number,
    isFiring?: boolean
  ): Promise<void> {
    if (isFiring === false) return;
    
    this.incidents.add(this.formatKey(incidentKey));
    
    const testId = this.testId || 'Unknown';
    const formattedMessage = message.join('\n  ');
    console.log(`${colors.yellow}${testId}${colors.reset}\n  ${colors.cyan}${formattedMessage}${colors.reset}`);
  }

  wasIncidentCreated(account: string, groupId: string, handlerType: string, token?: string): boolean {
    const key = this.formatKey({ account, groupId, handlerType, token });
    return this.incidents.has(key);
  }
  
  private formatKey(incidentKey: IncidentKey): string {
    const { account, groupId, handlerType, token } = incidentKey;
    return `${account}:${groupId}:${handlerType}:${token || 'none'}`;
  }
}

export const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
};
