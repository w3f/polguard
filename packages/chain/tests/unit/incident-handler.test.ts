import { Chain, MessengerType } from '@w3f/polguard-common';
import { IncidentHandler } from '../../src/lib/incident-handler';
import { InMemoryStore } from '../../src/service/store/in-memory.store';
import type { AppLogger, IncidentContent, IncidentKey, IncidentReporter, NotificationSettings } from '../../src/types';

const RECHECK_MS = 3 * 60 * 60 * 1000;

const silentLogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  child: () => silentLogger,
} as unknown as AppLogger;

const notifications: NotificationSettings = {
  messengerType: MessengerType.Matrix,
  channels: ['!room:web3.foundation'],
};

const incidentKey: IncidentKey = {
  groupId: 'companies-staking',
  handlerType: 'ActiveSetPresenceState',
  account: '157wUw3289QR7E2bMnVUxzwMYQX69S14kuYWARVYs4d8YEdt',
};

const content: IncidentContent = { condition: 'Not in active set', details: ['Era: 2269'] };

/** Reporter that succeeds by default; each behaviour is overridden per test. */
function createReporter(overrides: Partial<IncidentReporter> = {}) {
  return {
    createIncident: vi.fn().mockResolvedValue('INC1'),
    resolveIncident: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } satisfies IncidentReporter as IncidentReporter & {
    createIncident: ReturnType<typeof vi.fn>;
    resolveIncident: ReturnType<typeof vi.fn>;
  };
}

describe('IncidentHandler', () => {
  let store: InMemoryStore;

  beforeEach(() => {
    // Faked before the store exists so that its expiry sweeper is driven by the fake clock too.
    vi.useFakeTimers();
    store = new InMemoryStore(silentLogger);
  });

  afterEach(() => {
    store.destroy();
    vi.useRealTimers();
  });

  const build = (reporter: IncidentReporter) =>
    new IncidentHandler(silentLogger, store, reporter, Chain.AssetHubPolkadot);

  const fire = (handler: IncidentHandler, blockNumber: number, isFiring: boolean) =>
    handler.handle(content, notifications, incidentKey, { blockNumber }, isFiring);

  describe('ongoing incidents', () => {
    it('creates once while the condition keeps firing', async () => {
      const reporter = createReporter();
      const handler = build(reporter);

      await fire(handler, 1, true);
      await fire(handler, 2, true);
      await fire(handler, 3, true);

      expect(reporter.createIncident).toHaveBeenCalledTimes(1);
    });

    it('resolves with the tracked id once the condition stops firing', async () => {
      const reporter = createReporter();
      const handler = build(reporter);

      await fire(handler, 1, true);
      await fire(handler, 2, false);

      expect(reporter.resolveIncident).toHaveBeenCalledTimes(1);
      expect(reporter.resolveIncident.mock.calls[0][0]).toBe('INC1');
    });

    it('does not resolve when no incident is open', async () => {
      const reporter = createReporter();
      const handler = build(reporter);

      await fire(handler, 1, false);

      expect(reporter.resolveIncident).not.toHaveBeenCalled();
    });

    it('re-creates after the recheck window so an out-of-band resolution re-alerts', async () => {
      const reporter = createReporter();
      const handler = build(reporter);

      await fire(handler, 1, true);
      vi.advanceTimersByTime(RECHECK_MS + 1);
      await fire(handler, 2, true);

      expect(reporter.createIncident).toHaveBeenCalledTimes(2);
    });

    /**
     * The recheck deadline is data, not a TTL: an incident that has outlived it is still open, so a
     * condition clearing right after the deadline must still resolve.
     */
    it('still resolves an incident that has outlived the recheck window', async () => {
      const reporter = createReporter();
      const handler = build(reporter);

      await fire(handler, 1, true);
      vi.advanceTimersByTime(RECHECK_MS + 1);
      await fire(handler, 2, false);

      expect(reporter.resolveIncident).toHaveBeenCalledTimes(1);
      expect(reporter.resolveIncident.mock.calls[0][0]).toBe('INC1');
    });
  });

  /** A failed report must throw so that the watcher replays the block, rather than moving on. */
  describe('failed reports', () => {
    const failure = new Error('HTTP 503');

    it('throws and tracks nothing when the create fails', async () => {
      const createIncident = vi.fn().mockRejectedValueOnce(failure).mockResolvedValue('INC1');
      const handler = build(createReporter({ createIncident }));

      await expect(fire(handler, 1, true)).rejects.toThrow(failure);

      // Nothing cached, so the replay of block 1 creates the incident at block 1.
      await fire(handler, 1, true);
      expect(createIncident.mock.calls[1][0].blockNumber).toBe(1);
    });

    it('throws and keeps the incident open when the resolve fails', async () => {
      const reporter = createReporter({ resolveIncident: vi.fn().mockRejectedValue(failure) });
      const handler = build(reporter);

      await fire(handler, 1, true);
      await expect(fire(handler, 2, false)).rejects.toThrow(failure);

      reporter.resolveIncident.mockResolvedValue(undefined);
      await fire(handler, 2, false);
      expect(reporter.resolveIncident.mock.calls[1][0]).toBe('INC1');
    });
  });

  describe('one-time incidents', () => {
    it('reports every occurrence and never tracks state', async () => {
      const reporter = createReporter();
      const handler = build(reporter);

      await handler.handle(content, notifications, incidentKey, { blockNumber: 1, eventIdx: 0 });
      await handler.handle(content, notifications, incidentKey, { blockNumber: 1, eventIdx: 1 });

      expect(reporter.createIncident).toHaveBeenCalledTimes(2);
      expect(reporter.resolveIncident).not.toHaveBeenCalled();
    });
  });
});
