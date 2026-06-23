import { describe, it, expect } from 'vitest';
import { Chain, PayoutAccount } from '@w3f/polguard-common';
import { buildPlan } from '../src/planner';

function account(chain: Chain, signer: string, ss58: string): PayoutAccount {
  return { chain, signer, ss58, hex: '0x', name: ss58 };
}

const chains = {
  [Chain.AssetHubKusama]: { rpcUrl: 'wss://ksm' },
  [Chain.AssetHubPolkadot]: { rpcUrl: 'wss://dot' },
};
const signers = { 'cohort-x': 'seed-x', 'cohort-y': 'seed-y' };

describe('buildPlan', () => {
  it('groups accounts into cohorts by chain then signer', () => {
    const accounts = [
      account(Chain.AssetHubKusama, 'cohort-x', 'A'),
      account(Chain.AssetHubKusama, 'cohort-x', 'B'),
      account(Chain.AssetHubKusama, 'cohort-y', 'C'),
      account(Chain.AssetHubPolkadot, 'cohort-x', 'D'),
    ];

    const cohorts = buildPlan(accounts, { chains, signers });

    expect(cohorts).toHaveLength(3);
    expect(cohorts[0]).toMatchObject({ chain: Chain.AssetHubKusama, signer: 'cohort-x' });
    expect(cohorts[0].accounts.map(a => a.ss58)).toEqual(['A', 'B']);
    expect(cohorts[1]).toMatchObject({ chain: Chain.AssetHubKusama, signer: 'cohort-y' });
    expect(cohorts[2]).toMatchObject({ chain: Chain.AssetHubPolkadot, signer: 'cohort-x' });
  });

  it('throws when a chain has payout accounts but no rpcUrl configured', () => {
    const accounts = [account(Chain.Polkadot, 'cohort-x', 'A')];
    expect(() => buildPlan(accounts, { chains, signers })).toThrow(/Polkadot.*no rpcUrl/);
  });

  it('throws when a signer has no secret configured', () => {
    const accounts = [account(Chain.AssetHubKusama, 'unknown', 'A')];
    expect(() => buildPlan(accounts, { chains, signers })).toThrow(/"unknown".*no secret/);
  });

  it('returns an empty plan for no accounts', () => {
    expect(buildPlan([], { chains, signers })).toEqual([]);
  });
});
