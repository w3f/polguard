import { Formatter } from '../../src/lib/formatter';
import { ChainProperties, Chain } from '../../src/types';

describe('Formatter.balance()', () => {
  let formatter: Formatter;

  beforeEach(() => {
    const chainProps: ChainProperties = {
      chain: Chain.AssetHubPolkadot,
      specName: 'asset-hub-polkadot',
      chainDecimals: 10,
      chainToken: 'DOT',
      ss58Format: 0,
    };
    formatter = new Formatter(chainProps);
  });

  it('should format zero', () => {
    expect(formatter.balance(0)).toBe('0.00 DOT');
  });

  it('should format whole numbers', () => {
    // 100 DOT = 100 * 10^10
    expect(formatter.balance(BigInt(1000000000000))).toBe('100.00 DOT');
  });

  it('should format decimals', () => {
    // 1.23 DOT = 1.23 * 10^10
    expect(formatter.balance(BigInt(12300000000))).toBe('1.23 DOT');
  });

  it('should format with comma separators', () => {
    // 1,234.56 DOT = 1234.56 * 10^10
    expect(formatter.balance(BigInt(12345600000000))).toBe('1,234.56 DOT');
  });

  it('should handle bigint, string, and number inputs', () => {
    const amount = BigInt(1000000000000); // 100 DOT
    expect(formatter.balance(amount)).toBe('100.00 DOT');
    expect(formatter.balance('1000000000000')).toBe('100.00 DOT');
    expect(formatter.balance(1000000000000)).toBe('100.00 DOT');
  });

  it('should format custom tokens', () => {
    // USDT has 6 decimals: 100.50 USDT = 100.50 * 10^6
    expect(formatter.balance(BigInt(100500000), 'USDT')).toBe('100.50 USDT');
  });

  it('should handle precision without floating point errors', () => {
    // Test large amounts that would lose precision with floating point
    // 9,999,999,999.99 DOT = 9999999999.99 * 10^10 = 99999999999900000000
    expect(formatter.balance(BigInt('99999999999900000000'))).toBe('9,999,999,999.99 DOT');
  });

});
