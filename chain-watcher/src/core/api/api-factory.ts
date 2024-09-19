import { ApiPromise, WsProvider } from '@polkadot/api';

export class ApiFactory {
  private static MAX_RETRIES = 5;
  private static RETRY_DELAY = 5000; // 5 seconds

  static async create(rpcUrls: string[]): Promise<ApiPromise> {
    let currentIndex = 0;
    let retries = 0;

    // TODO: reconnect
    while (retries < this.MAX_RETRIES) {
      try {
        const api = await this.createApiWithProvider(rpcUrls[currentIndex]);
        console.log(`Connected to RPC: ${rpcUrls[currentIndex]}`);
        return api;
      } catch (error) {
        console.error(`Failed to connect to RPC ${rpcUrls[currentIndex]}: ${error.message}`);
        currentIndex = (currentIndex + 1) % rpcUrls.length;
        retries++;

        if (retries < this.MAX_RETRIES) {
          console.log(`Retrying with next RPC in ${this.RETRY_DELAY / 1000} seconds...`);
          await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY));
        }
      }
    }

    throw new Error('Failed to connect to any RPC after maximum retries');
  }

  private static async createApiWithProvider(rpcUrl: string): Promise<ApiPromise> {
    const provider = new WsProvider(rpcUrl, 1000);
    
    provider.on('error', (error) => {
      console.error(`WebSocket error: ${error.message}`);
      provider.connect();
    });

    provider.on('disconnected', () => {
      console.warn('WebSocket disconnected');
      provider.connect();
    });

    const api = await ApiPromise.create({ provider, noInitWarn: true });
    await api.isReady;

    return api;
  }
}
