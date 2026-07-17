import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Chain, MessengerType, type AppLogger, type PayoutAccount } from '@w3f/polguard-common';
import { reportClaims } from '../src/reporter';
import type { NotificationsConfig } from '../src/config';
import type { Claim } from '../src/claim-engine';

function fakeLogger(): AppLogger {
  return { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() } as unknown as AppLogger;
}

function account(ss58: string, name: string, channels?: string[], messengerType = MessengerType.Matrix): PayoutAccount {
  return {
    chain: Chain.AssetHubPolkadot,
    signer: 'signer-x',
    ss58,
    hex: '0x',
    name,
    notifications: channels ? { messengerType, channels } : undefined,
  };
}

function claim(stash: string, era: number, page: number): Claim {
  return { stash, name: stash, era, page, txHash: `0xtx${era}${page}` };
}

const notifications: NotificationsConfig = { matrix: { url: 'http://notifier/notifications' } };

describe('reportClaims', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('is a no-op when no service is configured for the messenger type', async () => {
    await reportClaims({}, Chain.AssetHubPolkadot, [account('A', 'A', ['!r'])], { ok: true, claims: [] }, fakeLogger());
    expect(fetch).not.toHaveBeenCalled();
  });

  it('routes each account only to its own channel, with explorer links', async () => {
    const accounts = [account('A', 'val-a', ['!room-a']), account('B', 'val-b', ['!room-b'])];
    const claims = [claim('A', 100, 0), claim('B', 100, 0)];

    await reportClaims(notifications, Chain.AssetHubPolkadot, accounts, { ok: true, claims }, fakeLogger());

    expect(fetch).toHaveBeenCalledTimes(2);
    const calls = (fetch as ReturnType<typeof vi.fn>).mock.calls.map(([, init]) => JSON.parse(init.body));
    const roomA = calls.find(c => c.channelId === '!room-a');
    const roomB = calls.find(c => c.channelId === '!room-b');
    expect(roomA.message).toContain('val-a');
    expect(roomA.message).not.toContain('val-b');
    expect(roomB.message).toContain('val-b');
    // Matrix → HTML rendering, with the extrinsic link from common's explorer
    expect(roomA.message).toContain('<a href="https://statemint.subscan.io/extrinsic/0xtx1000">');
  });

  it('reports a failure with the error message', async () => {
    await reportClaims(notifications, Chain.AssetHubPolkadot, [account('A', 'val-a', ['!room-a'])], { ok: false, error: new Error('boom') }, fakeLogger());
    const { message } = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(message).toContain('payout run failed');
    expect(message).toContain('boom');
  });

  it('skips accounts whose messenger type has no configured service', async () => {
    const accounts = [account('A', 'no-notify'), account('B', 'other', ['#x'], MessengerType.Telegram)];
    await reportClaims(notifications, Chain.AssetHubPolkadot, accounts, { ok: true, claims: [] }, fakeLogger());
    expect(fetch).not.toHaveBeenCalled();
  });

  it('logs an error but does not throw when the POST fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    const logger = fakeLogger();
    await reportClaims(notifications, Chain.AssetHubPolkadot, [account('A', 'val-a', ['!room-a'])], { ok: true, claims: [claim('A', 100, 0)] }, logger);
    expect(logger.error).toHaveBeenCalled();
  });
});
