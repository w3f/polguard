import { describe, it, expect, vi } from 'vitest';
import { Chain, type AppLogger, type PayoutAccount } from '@w3f/polguard-common';
import { buildPlan } from '../src/planner';

function account(chain: Chain, signer: string, ss58: string): PayoutAccount {
  return { chain, signer, group: 'group-x', ss58, hex: '0x', name: ss58 };
}

function fakeLogger(): AppLogger {
  return { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() } as unknown as AppLogger;
}

const chains = {
  [Chain.AssetHubKusama]: { rpcUrl: 'wss://ksm' },
  [Chain.AssetHubPolkadot]: { rpcUrl: 'wss://dot' },
};
const signers = { 'signer-x': 'seed-x', 'signer-y': 'seed-y' };

describe('buildPlan', () => {
  it('groups accounts into per-chain plans, then signer groups by signer', () => {
    const accounts = [
      account(Chain.AssetHubKusama, 'signer-x', 'A'),
      account(Chain.AssetHubKusama, 'signer-x', 'B'),
      account(Chain.AssetHubKusama, 'signer-y', 'C'),
      account(Chain.AssetHubPolkadot, 'signer-x', 'D'),
    ];

    const plan = buildPlan(accounts, { chains, signers }, fakeLogger());

    expect(plan).toHaveLength(2);
    expect(plan[0]).toMatchObject({ chain: Chain.AssetHubKusama, rpcUrl: 'wss://ksm' });
    expect(plan[0].groups).toHaveLength(2);
    expect(plan[0].groups[0]).toMatchObject({ signer: 'signer-x' });
    expect(plan[0].groups[0].accounts.map(a => a.ss58)).toEqual(['A', 'B']);
    expect(plan[0].groups[1]).toMatchObject({ signer: 'signer-y' });
    expect(plan[1]).toMatchObject({ chain: Chain.AssetHubPolkadot, rpcUrl: 'wss://dot' });
    expect(plan[1].groups).toHaveLength(1);
  });

  it('skips (with a warning) a chain that has payout accounts but no rpcUrl', () => {
    const logger = fakeLogger();
    const plan = buildPlan([account(Chain.Polkadot, 'signer-x', 'A')], { chains, signers }, logger);
    expect(plan).toEqual([]);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringMatching(/Polkadot.*no rpcUrl/));
  });

  it('skips (with a warning) a signer that has no secret', () => {
    const logger = fakeLogger();
    const plan = buildPlan([account(Chain.AssetHubKusama, 'unknown', 'A')], { chains, signers }, logger);
    expect(plan).toEqual([]);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringMatching(/"unknown".*no secret/));
  });

  it('returns an empty plan for no accounts', () => {
    expect(buildPlan([], { chains, signers }, fakeLogger())).toEqual([]);
  });
});
