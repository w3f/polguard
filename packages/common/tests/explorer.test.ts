import { buildExplorerUrl } from '../src/explorer';
import { Chain } from '../src/constants';

describe('buildExplorerUrl', () => {
  it('uses the chain specName as the subscan subdomain, not the chain name', () => {
    // AssetHubPolkadot -> specName "statemint" (the chain name would be the invalid "assethubpolkadot")
    expect(buildExplorerUrl(Chain.AssetHubPolkadot, 'event', '100-5')).toBe(
      'https://statemint.subscan.io/event/100-5',
    );
    expect(buildExplorerUrl(Chain.AssetHubKusama, 'account', 'addr')).toBe(
      'https://statemine.subscan.io/account/addr',
    );
  });

  it('builds extrinsic and block urls for relay chains', () => {
    expect(buildExplorerUrl(Chain.Polkadot, 'extrinsic', '200-3')).toBe(
      'https://polkadot.subscan.io/extrinsic/200-3',
    );
    expect(buildExplorerUrl(Chain.Polkadot, 'block', 300)).toBe('https://polkadot.subscan.io/block/300');
  });

  it('uses statescan with the /#/ prefix and pluralized resources for Frequency', () => {
    expect(buildExplorerUrl(Chain.Frequency, 'event', '10-1')).toBe('https://frequency.statescan.io/#/events/10-1');
    expect(buildExplorerUrl(Chain.Frequency, 'account', 'addr')).toBe('https://frequency.statescan.io/#/accounts/addr');
  });
});
