import path from 'node:path';
import { encodeAddress, decodeAddress } from '@polkadot/util-crypto';
import { AppLogger, Chain, MessengerType, getChainProperties } from '@w3f/polguard-common';
import { getPayoutAccounts } from '../src/payout/payout-resolver';
import { getMonitoringGroups } from '../src/loader';

const FIXTURES_DIR = path.join(__dirname, 'fixtures/payout');

function ss58For(address: string, chain: Chain): string {
  return encodeAddress(decodeAddress(address), getChainProperties(chain).ss58Format);
}

function createLogger(): AppLogger & { warnings: string[] } {
  const warnings: string[] = [];
  return {
    warnings,
    fatal: () => {},
    error: () => {},
    warn: (msg: string) => warnings.push(msg),
    info: () => {},
    debug: () => {},
    trace: () => {},
  };
}

describe('getPayoutAccounts', () => {
  it('projects a standalone payout config across chains with chain-correct SS58', async () => {
    const dir = path.join(FIXTURES_DIR, 'standalone');
    const accounts = await getPayoutAccounts(dir, createLogger());

    expect(accounts).toHaveLength(2);

    const address = '16cdSZUq7kxq6mtoVMWmYXo62FnNGT9jzWjVRUg87CpL9pxP';
    const kusama = accounts.find(a => a.chain === Chain.AssetHubKusama);
    const polkadot = accounts.find(a => a.chain === Chain.AssetHubPolkadot);

    expect(kusama).toMatchObject({
      name: 'VALIDATOR-A',
      ss58: ss58For(address, Chain.AssetHubKusama),
      signer: 'shared-signer',
      notifications: { messengerType: MessengerType.Matrix, channels: ['!payouts:web3.foundation'] },
    });
    expect(polkadot?.ss58).toBe(ss58For(address, Chain.AssetHubPolkadot));
    expect(kusama?.ss58).not.toBe(polkadot?.ss58);
  });

  it('does not surface a standalone payout config to monitoring', async () => {
    const dir = path.join(FIXTURES_DIR, 'standalone');
    const groups = await getMonitoringGroups(Chain.AssetHubKusama, dir, createLogger());
    expect(groups).toEqual([]);
  });

  it('enrolls per-group, lets an account override only the signer, and inherits the payout room', async () => {
    const dir = path.join(FIXTURES_DIR, 'mixed');
    const accounts = await getPayoutAccounts(dir, createLogger());

    const def = accounts.find(a => a.name === 'VALIDATOR-DEFAULT');
    const special = accounts.find(a => a.name === 'VALIDATOR-SPECIAL');

    expect(def).toMatchObject({
      signer: 'companies-ksm',
      notifications: { channels: ['!payouts-ksm:web3.foundation'] },
    });
    expect(special).toMatchObject({
      signer: 'special-ksm',
      notifications: { channels: ['!payouts-ksm:web3.foundation'] },
    });
  });

  it('falls back to the monitoring channel when a payout group has no payout notifications', async () => {
    const dir = path.join(FIXTURES_DIR, 'mixed');
    const accounts = await getPayoutAccounts(dir, createLogger());

    const fallback = accounts.find(a => a.name === 'VALIDATOR-FALLBACK');
    expect(fallback).toMatchObject({
      signer: 'fallback-ksm',
      notifications: { channels: ['!alerts:web3.foundation'] },
    });
  });

  it('excludes monitoring-only groups from payouts', async () => {
    const dir = path.join(FIXTURES_DIR, 'mixed');
    const accounts = await getPayoutAccounts(dir, createLogger());
    expect(accounts.find(a => a.name === 'PARTNER-A')).toBeUndefined();
  });

  it('still exposes monitored groups to monitoring in a mixed config', async () => {
    const dir = path.join(FIXTURES_DIR, 'mixed');
    const groups = await getMonitoringGroups(Chain.AssetHubKusama, dir, createLogger());
    const ids = groups.map(g => g.id);
    expect(ids).toContain('companies-validators-group');
    expect(ids).toContain('partners-monitoring-only-grp');
  });

  it('throws naming the group and account when a resolved signer is missing', async () => {
    const dir = path.join(FIXTURES_DIR, 'missing-signer');
    await expect(getPayoutAccounts(dir, createLogger())).rejects.toThrow(
      /missing-signer-group-xx.*NO-SIGNER-VALIDATOR/,
    );
  });
});
