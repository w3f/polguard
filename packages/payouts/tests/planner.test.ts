import { describe, it, expect, vi } from 'vitest';
import { Chain, type AppLogger, type PayoutAccount } from '@w3f/polguard-common';
import { buildPlan } from '../src/planner';

function account(chain: Chain, signer: string, ss58: string): PayoutAccount {
  return { chain, signer, ss58, hex: '0x', name: ss58 };
}

function fakeLogger(): AppLogger {
  return { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() } as unknown as AppLogger;
}

const chains = {
  [Chain.AssetHubKusama]: { rpcUrl: 'wss://ksm' },
  [Chain.AssetHubPolkadot]: { rpcUrl: 'wss://dot' },
};
const signers = { 'cohort-x': 'seed-x', 'cohort-y': 'seed-y' };

describe('buildPlan', () => {
  it('groups accounts into per-chain plans, then cohorts by signer', () => {
    const accounts = [
      account(Chain.AssetHubKusama, 'cohort-x', 'A'),
      account(Chain.AssetHubKusama, 'cohort-x', 'B'),
      account(Chain.AssetHubKusama, 'cohort-y', 'C'),
      account(Chain.AssetHubPolkadot, 'cohort-x', 'D'),
    ];

    const plan = buildPlan(accounts, { chains, signers }, fakeLogger());

    expect(plan).toHaveLength(2);
    expect(plan[0]).toMatchObject({ chain: Chain.AssetHubKusama, rpcUrl: 'wss://ksm' });
    expect(plan[0].cohorts).toHaveLength(2);
    expect(plan[0].cohorts[0]).toMatchObject({ signer: 'cohort-x' });
    expect(plan[0].cohorts[0].accounts.map(a => a.ss58)).toEqual(['A', 'B']);
    expect(plan[0].cohorts[1]).toMatchObject({ signer: 'cohort-y' });
    expect(plan[1]).toMatchObject({ chain: Chain.AssetHubPolkadot, rpcUrl: 'wss://dot' });
    expect(plan[1].cohorts).toHaveLength(1);
  });

  it('skips (with a warning) a chain that has payout accounts but no rpcUrl', () => {
    const logger = fakeLogger();
    const plan = buildPlan([account(Chain.Polkadot, 'cohort-x', 'A')], { chains, signers }, logger);
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
