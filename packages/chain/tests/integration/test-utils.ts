import { Logger, NotificationSettings, IncidentHandlerClient, IncidentKey, BlockContext } from '@w3f/polguard-common';

export class LoggerAdapter implements Logger {
  constructor(
    private console: Console = global.console,
    private debugMode: boolean = false,
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

export class TestIncidentHandler implements IncidentHandlerClient {
  private incidents: Map<string, number> = new Map();

  constructor(private testId?: string) {}

  async handle(
    message: string[],
    notifications: NotificationSettings,
    incidentKey: IncidentKey,
    blockContext: BlockContext,
    isFiring?: boolean,
  ): Promise<void> {
    if (isFiring === false) return;

    const key = this.formatKey(incidentKey);
    const currentCount = this.incidents.get(key) || 0;
    this.incidents.set(key, currentCount + 1);

    const testId = this.testId || 'Unknown';
    const formattedMessage = message.join('\n  ');
    console.log(`${colors.yellow}${testId}${colors.reset}\n  ${colors.cyan}${formattedMessage}${colors.reset}`);
  }

  getIncidentCount(account: string, groupId: string, handlerType: string): number {
    const prefix = `${account}:${groupId}:${handlerType}:`;
    let total = 0;
    for (const [k, v] of this.incidents.entries()) {
      if (k.startsWith(prefix)) total += v;
    }
    return total;
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
  cyan: '\x1b[36m',
};
