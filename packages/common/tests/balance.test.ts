import { balance } from '../src/balance';
import { Chain } from '../src/constants';

describe('balance()', () => {
  const chain = Chain.AssetHubPolkadot; // 10 decimals, DOT

  it('should format zero', () => {
    expect(balance(chain, 0)).toBe('0.00 DOT');
  });

  it('should format whole numbers', () => {
    // 100 DOT = 100 * 10^10
    expect(balance(chain, BigInt(1000000000000))).toBe('100.00 DOT');
  });

  it('should format decimals', () => {
    // 1.23 DOT = 1.23 * 10^10
    expect(balance(chain, BigInt(12300000000))).toBe('1.23 DOT');
  });

  it('should format with comma separators', () => {
    // 1,234.56 DOT = 1234.56 * 10^10
    expect(balance(chain, BigInt(12345600000000))).toBe('1,234.56 DOT');
  });

  it('should handle bigint, string, and number inputs', () => {
    const amount = BigInt(1000000000000); // 100 DOT
    expect(balance(chain, amount)).toBe('100.00 DOT');
    expect(balance(chain, '1000000000000')).toBe('100.00 DOT');
    expect(balance(chain, 1000000000000)).toBe('100.00 DOT');
  });

  it('should format custom tokens', () => {
    // USDT has 6 decimals: 100.50 USDT = 100.50 * 10^6
    expect(balance(chain, BigInt(100500000), 'USDT')).toBe('100.50 USDT');
  });

  it('should fall back for unknown tokens', () => {
    expect(balance(chain, BigInt(5), 'UNKNOWN')).toBe('5 token UNKNOWN');
  });

  it('should handle precision without floating point errors', () => {
    // 9,999,999,999.99 DOT = 9999999999.99 * 10^10 = 99999999999900000000
    expect(balance(chain, BigInt('99999999999900000000'))).toBe('9,999,999,999.99 DOT');
  });
});
