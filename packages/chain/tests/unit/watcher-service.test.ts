import { WatcherService } from '../../src/service/watcher/watcher.service';
import type { AppLogger } from '../../src/types';

const MINUTE_MS = 60_000;

const silentLogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  child: () => silentLogger,
} as unknown as AppLogger;

/** A started service whose connection + watcher build is replaced by `build`. */
async function startService(build: () => Promise<void>, lastProcessedBlock: () => number | undefined) {
  const config = { getChain: () => 'AssetHubKusama', getStartBlock: () => undefined };
  const store = { getLastBlock: async () => 100, setLastBlock: vi.fn().mockResolvedValue(undefined) };
  const telemetry = { recordProcessedBlock: vi.fn() };
  const service = new WatcherService(silentLogger, config as any, telemetry as any, store as any, {} as any);

  const buildAndStart = vi.spyOn(service as any, 'buildAndStart').mockImplementation(async () => {
    (service as any).watcher = { getLastProcessedBlock: lastProcessedBlock, stop: async () => {} };
    await build();
  });
  await service.start();

  return { service, rebuilds: () => buildAndStart.mock.calls.length - 1 };
}

describe('WatcherService stall guard', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('publishes the stored watermark before connecting', async () => {
    const hang = () => new Promise<void>(() => {});
    const config = { getChain: () => 'AssetHubKusama', getStartBlock: () => undefined };
    const telemetry = { recordProcessedBlock: vi.fn() };
    const service = new WatcherService(
      silentLogger,
      config as any,
      telemetry as any,
      { getLastBlock: async () => 100 } as any,
      {} as any,
    );
    vi.spyOn(service as any, 'buildAndStart').mockImplementation(hang);

    void service.start();
    await vi.advanceTimersByTimeAsync(0);

    expect(telemetry.recordProcessedBlock).toHaveBeenCalledWith(100);
    await service.stop();
  });

  it('does nothing while blocks keep being processed', async () => {
    let block = 100;
    const { service, rebuilds } = await startService(
      async () => {},
      () => block,
    );

    for (let i = 0; i < 30; i++) {
      block++;
      await vi.advanceTimersByTimeAsync(MINUTE_MS);
    }

    expect(rebuilds()).toBe(0);
    await service.stop();
  });

  it('rebuilds once after a stall, then throws for the process to exit', async () => {
    const { rebuilds } = await startService(
      async () => {},
      () => 100,
    );

    await vi.advanceTimersByTimeAsync(3 * MINUTE_MS);
    expect(rebuilds()).toBe(1);

    await vi.advanceTimersByTimeAsync(6 * MINUTE_MS);
    expect(rebuilds()).toBe(1);

    expect(() => vi.advanceTimersByTime(2 * MINUTE_MS)).toThrow(/No block progress/);
  });

  it('still throws when the rebuild never completes', async () => {
    let builds = 0;
    const hangOnRebuild = () => (builds++ === 0 ? Promise.resolve() : new Promise<void>(() => {}));
    const { rebuilds } = await startService(hangOnRebuild, () => 100);

    await vi.advanceTimersByTimeAsync(9 * MINUTE_MS);
    expect(rebuilds()).toBe(1);

    expect(() => vi.advanceTimersByTime(2 * MINUTE_MS)).toThrow(/No block progress/);
  });
});
