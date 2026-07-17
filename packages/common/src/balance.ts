import { Chain, getChainProperties, CHAIN_TOKENS } from './constants';

/**
 * Converts raw blockchain amounts to a human-readable format.
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
  const integerStr = integerPart.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const fractionalStr = scaledFractional.toString().padStart(2, '0');
  const sign = isNegative ? '-' : '';
  return `${sign}${integerStr}.${fractionalStr} ${unit}`;
}

/** Chain/token-aware human-readable balance, e.g. "1,234.56 DOT". */
export function balance(chain: Chain, amount: number | string | bigint, tokenName?: string): string {
  const props = getChainProperties(chain);
  if (!tokenName) return formatBalance(amount, props.chainDecimals, props.chainToken);

  const token = CHAIN_TOKENS[chain][tokenName];
  if (token) return formatBalance(amount, token.decimals, tokenName);

  return `${amount.toString()} token ${tokenName}`;
}
