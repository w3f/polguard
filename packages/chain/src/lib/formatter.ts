import { ChainProperties, Chain, CHAIN_TOKENS, BlockContext } from '../types';

const STATESCAN_CHAINS: Chain[] = [Chain.Frequency];

/**
 * Custom balance formatter that converts raw blockchain amounts to human-readable format.
 * 
 * @param amount - The raw amount (can be number, string, or bigint)
 * @param decimals - Number of decimal places the token uses (e.g., 10 for DOT, 6 for USDT)
 * @param unit - The token symbol to append (e.g., 'DOT', 'USDT')
 * @returns Formatted string with comma separators and 2 decimal places (e.g., "1,234.56 DOT")
 */
function formatBalance(amount: number | string | bigint, decimals: number, unit: string): string {
  let amountBigInt: bigint;
  if (typeof amount === 'bigint') {
    amountBigInt = amount;
  } else if (typeof amount === 'string') {
    const cleaned = amount.replace(/[^0-9.-]/g, '');
    amountBigInt = BigInt(cleaned);
  } else {
    amountBigInt = BigInt(Math.floor(amount));
  }

  const isNegative = amountBigInt < 0n;
  if (isNegative) {
    amountBigInt = -amountBigInt;
  }

  const divisor = BigInt(10 ** decimals);
  const integerPart = amountBigInt / divisor;
  const fractionalPart = amountBigInt % divisor;
  const scaledFractional = (fractionalPart * 100n) / divisor;
  
  // Round if necessary (happens when we have more than 2 decimal places)
  // Check if the next digit would round up
  const remainder = (fractionalPart * 1000n) / divisor % 10n;
  const roundedFractional = remainder >= 5n ? scaledFractional + 1n : scaledFractional;
  
  // Handle rounding overflow (e.g., 99.996 -> 100.00)
  let finalInteger = integerPart;
  let finalFractional = roundedFractional;
  if (finalFractional >= 100n) {
    finalInteger += 1n;
    finalFractional = 0n;
  }
  
  const integerStr = finalInteger.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const fractionalStr = finalFractional.toString().padStart(2, '0');
  
  const sign = isNegative ? '-' : '';
  return `${sign}${integerStr}.${fractionalStr} ${unit}`;
}

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
      return formatBalance(amount, this.chainProps.chainDecimals, this.chainProps.chainToken);
    }

    if (CHAIN_TOKENS[this.chainProps.chain][tokenName]) {
      return formatBalance(
        amount,
        CHAIN_TOKENS[this.chainProps.chain][tokenName].decimals,
        tokenName,
      );
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
