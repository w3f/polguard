import { formatBalance } from '@polkadot/util';
import { CHAIN_TOKENS, ChainProperties, BlockContext } from '@w3f/monitoring-types';

export class Formatter {
  constructor(private chainProps: ChainProperties) {}

  private getEventURL(blockNumber: number, eventIdx: number): string {
    return `https://${this.chainProps.specName}.subscan.io/event/${blockNumber}-${eventIdx}`;
  }

  private getExtrinsicURL(blockNumber: number, extrinsicIdx: number): string {
    return `https://${this.chainProps.specName}.subscan.io/extrinsic/${blockNumber}-${extrinsicIdx}`;
  }

  private getBlockURL(blockNumber: number): string {
    return `https://${this.chainProps.specName}.subscan.io/block/${blockNumber}`;
  }

  private getAccountURL(address: string): string {
    return `https://${this.chainProps.specName}.subscan.io/account/${address}`;
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
        result.push(this.link('Subscan: event', this.getEventURL(blockContext.blockNumber, blockContext.eventIdx)));
      } else if (blockContext.extrinsicIdx !== undefined) {
        result.push(
          this.link('Subscan: extrinsic', this.getExtrinsicURL(blockContext.blockNumber, blockContext.extrinsicIdx)),
        );
      } else {
        result.push(this.link('Subscan: block', this.getBlockURL(blockContext.blockNumber)));
      }
    }

    result.push(`Chain: ${this.chainProps.chain}`);
    return result;
  }
}
