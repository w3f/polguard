import { ApiPromise, WsProvider } from '@polkadot/api';
import { Logger } from '../interfaces';

export class ReconnectableApi {
  private api: ApiPromise | null = null;
  private rpcUrls: string[];
  private currentRpcIndex: number = 0;
  private reconnectAttempts: number = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private readonly RECONNECT_DELAY = 5000; // 5 seconds

  constructor(private logger: Logger) {}

  async connect(rpcUrls: string[]): Promise<ApiPromise> {
    this.rpcUrls = rpcUrls;
    return this.initializeConnection();
  }

  private async initializeConnection(): Promise<ApiPromise> {
    while (this.currentRpcIndex < this.rpcUrls.length) {
      try {
        const provider = new WsProvider(this.rpcUrls[this.currentRpcIndex]);
        this.api = await ApiPromise.create({ provider, noInitWarn: true });
        await this.api.isReady;
        this.logger.log(`Connected to RPC: ${this.rpcUrls[this.currentRpcIndex]}`);
        this.setupEventListeners();
        return this.api;
      } catch (error) {
        this.logger.error(`Failed to connect to RPC ${this.rpcUrls[this.currentRpcIndex]}: ${error.message}`);
        this.currentRpcIndex++;
      }
    }
    throw new Error('Failed to connect to any RPC');
  }

  private setupEventListeners(): void {
    if (!this.api) return;

    this.api.on('disconnected', async () => {
      this.logger.warn('API disconnected');
      await this.reconnect();
    });

    this.api.on('error', (error) => {
      this.logger.error(`API error: ${error.message}`);
    });
  }

  private async reconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      this.logger.error('Max reconnection attempts reached. Giving up.');
      return;
    }

    this.reconnectAttempts++;
    try {
      this.currentRpcIndex = (this.currentRpcIndex + 1) % this.rpcUrls.length;
      await this.initializeConnection();
      this.reconnectAttempts = 0;
      this.logger.log('API reconnected');
    } catch (error) {
      this.logger.error(`Failed to reconnect: ${error.message}`);
      setTimeout(() => this.reconnect(), this.RECONNECT_DELAY);
    }
  }

  getApi(): ApiPromise {
    if (!this.api) {
      throw new Error('API not initialized. Call connect() first.');
    }
    return this.api;
  }
}
