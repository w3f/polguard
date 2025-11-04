import { formatBalance } from '@polkadot/util';
import { CHAIN_TOKENS, ChainProperties, BlockContext, Chain } from '@w3f/monitoring-types';

const STATESCAN_CHAINS: Chain[] = [Chain.Frequency];

export class Formatter {
  constructor(private chainProps: ChainProperties) {}

  private useStatescan(): boolean {
    return STATESCAN_CHAINS.includes(this.chainProps.chain);
  }

  private buildExplorerURL(resource: string, identifier: string | number): string {
    const isStatescan = this.useStatescan();
    const domain = isStatescan ? 'statescan.io' : 'subscan.io';
    const pathPrefix = isStatescan ? '/#/' : '/';
    const resourceName = isStatescan ? `${resource}s` : resource;

    return `https://${this.chainProps.specName}.${domain}${pathPrefix}${resourceName}/${identifier}`;
  }

  private getEventURL(blockNumber: number, eventIdx: number): string {
    return this.buildExplorerURL('event', `${blockNumber}-${eventIdx}`);
  }

  private getExtrinsicURL(blockNumber: number, extrinsicIdx: number): string {
    return this.buildExplorerURL('extrinsic', `${blockNumber}-${extrinsicIdx}`);
  }

  private getBlockURL(blockNumber: number): string {
    return this.buildExplorerURL('block', blockNumber);
  }

  private getAccountURL(address: string): string {
    return this.buildExplorerURL('account', address);
  }

  link(title: string, url: string): string {
    return `[${title}](${url})`;
  }

  accountLink(name: string, address: string): string {
    return this.link(name, this.getAccountURL(address));
  }

  balance(amount: number | string | bigint, tokenName?: string): string {
    // If no token is provided, use native token
    if (!tokenName) {
      return formatBalance(amount, {
        decimals: this.chainProps.chainDecimals,
        withUnit: this.chainProps.chainToken,
        withSi: true,
        forceUnit: '-',
      });
    }

    if (CHAIN_TOKENS[this.chainProps.chain][tokenName]) {
      return formatBalance(amount, {
        decimals: CHAIN_TOKENS[this.chainProps.chain][tokenName].decimals,
        withUnit: tokenName,
        withSi: true,
        forceUnit: '-',
      });
    }

    return `${amount.toString()} token ${tokenName}`;
  }

  message(rows: string[], blockContext?: BlockContext): string[] {
    const result = rows.filter(Boolean);

    if (blockContext) {
      result.push(`Block: ${blockContext.blockNumber}`);
      if (blockContext.eventIdx !== undefined) {
        result.push(this.link('Explorer: event', this.getEventURL(blockContext.blockNumber, blockContext.eventIdx)));
      } else if (blockContext.extrinsicIdx !== undefined) {
        result.push(
          this.link('Explorer: extrinsic', this.getExtrinsicURL(blockContext.blockNumber, blockContext.extrinsicIdx)),
        );
      } else {
        result.push(this.link('Explorer: block', this.getBlockURL(blockContext.blockNumber)));
      }
    }

    result.push(`Chain: ${this.chainProps.chain}`);
    return result;
  }
}
