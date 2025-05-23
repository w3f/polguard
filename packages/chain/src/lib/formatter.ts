import { Phase } from '@polkadot/types/interfaces';
import { formatBalance } from '@polkadot/util';
import { CHAIN_TOKENS, ChainProperties } from '@w3f/monitoring-types';

export class Formatter {
  constructor(private chainProps: ChainProperties) {}

  private getEventURL(blockNumber: number, phase: Phase): string {
    if (!phase.isApplyExtrinsic) {
      return '';
    }
    const index = phase.asApplyExtrinsic.toNumber();
    return `https://${this.chainProps.specName}.subscan.io/event?extrinsic=${blockNumber}-${index}`;
  }

  private getAccountURL(address: string): string {
    return `https://${this.chainProps.specName}.subscan.io/account/${address}`;
  }

  private getExtrinsicURL(blockNumber: number, extrinsicIndex: number): string {
    return `https://${this.chainProps.specName}.subscan.io/extrinsic/${blockNumber}-${extrinsicIndex}`;
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

  message(
    rows: string[],
    options?: {
      blockNumber: number;
      phase?: Phase;
      extrinsicIndex?: number;
    },
  ): string[] {
    const result = [...rows];

    if (options) {
      result.push(`Block: ${options.blockNumber}`);

      if (options.phase !== undefined) {
        result.push(`Event: ${this.getEventURL(options.blockNumber, options.phase)}`);
      } else if (options.extrinsicIndex !== undefined) {
        result.push(`Extrinsic: ${this.getExtrinsicURL(options.blockNumber, options.extrinsicIndex)}`);
      }
    }

    result.push(`Chain: ${this.chainProps.chain}`);
    return result;
  }
}
