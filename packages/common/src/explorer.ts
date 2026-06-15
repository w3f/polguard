import { Chain, getChainProperties } from './constants';

const STATESCAN_CHAINS: Chain[] = [Chain.Frequency];

export type ExplorerResource = 'event' | 'extrinsic' | 'block' | 'account';

export function buildExplorerUrl(chain: Chain, resource: ExplorerResource, identifier: string | number): string {
  const { specName } = getChainProperties(chain);
  const isStatescan = STATESCAN_CHAINS.includes(chain);
  const domain = isStatescan ? 'statescan.io' : 'subscan.io';
  const pathPrefix = isStatescan ? '/#/' : '/';
  const resourceName = isStatescan ? `${resource}s` : resource;

  return `https://${specName}.${domain}${pathPrefix}${resourceName}/${identifier}`;
}
