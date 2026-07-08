import type { AppLogger } from '@w3f/polguard-common';
import { getWsProvider } from 'polkadot-api/ws';
import { createClient } from 'polkadot-api';
import type { PolkadotClient } from 'polkadot-api';

export interface ChainConnectionOptions {
  expectedSpecName?: string;
}

export interface StuckGuardOptions {
  intervalMs?: number;
  thresholdMs?: number;
}

/**
 * Owns the RPC connection and all reconnect concerns.
 *
 * `getWsProvider` accepts a list of endpoints and rotates to the next one on ws
 * error/close and on a forced `switch()` (verified: `actualEndpoints[idx++ % length]`).
 * That native failover handles socket-level failures (error, close, ~40s heartbeat stale).
 * The opt-in `startStuckGuard` watchdog covers a different failure the socket layer can't
 * see: the connection stays healthy but new blocks stop arriving.
 */
export class ChainConnection {
  private static readonly DEFAULT_HEALTH_CHECK_INTERVAL_MS = 30_000;
  private static readonly DEFAULT_STUCK_THRESHOLD_MS = 2 * 60_000;

  private stuckGuard?: NodeJS.Timeout;

  private constructor(
    readonly client: PolkadotClient,
    private readonly provider: ReturnType<typeof getWsProvider>,
    private readonly logger: AppLogger,
  ) {}

  static async connect(
    endpoints: string | string[],
    logger: AppLogger,
    opts: ChainConnectionOptions = {},
  ): Promise<ChainConnection> {
    const provider = getWsProvider(endpoints, {
      onStatusChanged: status =>
        logger.info(`RPC status: ${status.type}${'uri' in status ? ` (${status.uri})` : ''}`),
    });
    const client = createClient(provider);

    // Validate chain by checking runtime spec
    // TODO: fix expectedSpecName, raise if mismatch
    if (opts.expectedSpecName) {
      const { name: specName } = await client.getChainSpecData();
      if (specName !== opts.expectedSpecName) {
        logger.warn(
          `Chain spec mismatch: expected "${opts.expectedSpecName}" but RPC returns "${specName}". ` +
            `This may indicate a misconfigured RPC endpoint.`,
        );
      }
    }

    logger.info(`Connected to RPC: ${[endpoints].flat().join(', ')}`);
    return new ChainConnection(client, provider, logger);
  }

  /** Force a reconnect, rotating to the next endpoint in the list (or a specific `uri`). */
  switch(uri?: string): void {
    this.provider.switch(uri);
  }

  /**
   * Guards against a stuck RPC connection: if `getProgress` stops advancing for longer than
   * the threshold, force a reconnect.
   */
  startStuckGuard(getProgress: () => number | undefined, opts: StuckGuardOptions = {}): void {
    const intervalMs = opts.intervalMs ?? ChainConnection.DEFAULT_HEALTH_CHECK_INTERVAL_MS;
    const thresholdMs = opts.thresholdMs ?? ChainConnection.DEFAULT_STUCK_THRESHOLD_MS;

    let lastProgress: number | undefined;
    let lastProgressAt = Date.now();

    this.stuckGuard = setInterval(() => {
      const current = getProgress();
      if (current !== lastProgress) {
        lastProgress = current;
        lastProgressAt = Date.now();
        return;
      }
      if (Date.now() - lastProgressAt > thresholdMs) {
        this.logger.error(
          `No block progress in over ${thresholdMs}ms (stuck at ${current}). Forcing RPC reconnect...`,
        );
        this.provider.switch();
        lastProgressAt = Date.now();
      }
    }, intervalMs);
  }

  destroy(): void {
    if (this.stuckGuard) {
      clearInterval(this.stuckGuard);
    }
    this.client.destroy();
  }
}
