import { AddressTransformer } from '../src/address-transformer';
import { Chain, getChainProperties } from '@w3f/monitoring-types';
import { encodeAddress } from '@polkadot/util-crypto';
import { hexToU8a } from '@polkadot/util';

describe('AddressTransformer', () => {
  const TEST_HEX = '0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d';
  const POLKADOT_SS58 = encodeAddress(hexToU8a(TEST_HEX), getChainProperties(Chain.Polkadot).ss58Format);
  const KUSAMA_SS58 = encodeAddress(hexToU8a(TEST_HEX), getChainProperties(Chain.Kusama).ss58Format);
  const PEOPLE_POLKADOT_SS58 = encodeAddress(hexToU8a(TEST_HEX), getChainProperties(Chain.PeoplePolkadot).ss58Format);
  const PEOPLE_KUSAMA_SS58 = encodeAddress(hexToU8a(TEST_HEX), getChainProperties(Chain.PeopleKusama).ss58Format);

  describe('hex address input', () => {
    it('should transform hex to Polkadot SS58', () => {
      const result = AddressTransformer.transform(
        TEST_HEX,
        'test',
        getChainProperties(Chain.Polkadot)
      );
      
      expect(result.ss58).toBe(POLKADOT_SS58);
      expect(result.hex).toBe(TEST_HEX);
      expect(result.name).toBe('test');
    });

    it('should transform hex to Kusama SS58', () => {
      const result = AddressTransformer.transform(
        TEST_HEX,
        'test',
        getChainProperties(Chain.Kusama)
      );
      
      expect(result.ss58).toBe(KUSAMA_SS58);
      expect(result.hex).toBe(TEST_HEX);
    });

    it('should generate name from SS58 when name not provided', () => {
      const result = AddressTransformer.transform(
        TEST_HEX,
        undefined,
        getChainProperties(Chain.Polkadot)
      );
      
      expect(result.name).toBe(`${POLKADOT_SS58.slice(0, 4)}...${POLKADOT_SS58.slice(-4)}`);
    });
  });

  describe('SS58 address input', () => {
    it('should maintain Polkadot SS58 when chain is Polkadot', () => {
      const result = AddressTransformer.transform(
        POLKADOT_SS58,
        'test',
        getChainProperties(Chain.Polkadot)
      );
      
      expect(result.ss58).toBe(POLKADOT_SS58);
      expect(result.hex).toBe(TEST_HEX);
      expect(result.name).toBe('test');
    });

    it('should transform Polkadot SS58 to Kusama format', () => {
      const result = AddressTransformer.transform(
        POLKADOT_SS58,
        'test',
        getChainProperties(Chain.Kusama)
      );
      
      expect(result.ss58).toBe(KUSAMA_SS58);
      expect(result.hex).toBe(TEST_HEX);
    });

    it('should transform Kusama SS58 to Polkadot format', () => {
      const result = AddressTransformer.transform(
        KUSAMA_SS58,
        'test',
        getChainProperties(Chain.Polkadot)
      );
      
      expect(result.ss58).toBe(POLKADOT_SS58);
      expect(result.hex).toBe(TEST_HEX);
    });

    it('should generate name from target chain SS58 when name not provided', () => {
      const result = AddressTransformer.transform(
        KUSAMA_SS58,
        undefined,
        getChainProperties(Chain.Polkadot)
      );
      
      expect(result.name).toBe(`${POLKADOT_SS58.slice(0, 4)}...${POLKADOT_SS58.slice(-4)}`);
    });
  });

  describe('error handling', () => {
    it('should throw on invalid hex format', () => {
      expect(() => {
        AddressTransformer.transform(
          '0xinvalid',
          'test',
          getChainProperties(Chain.Polkadot)
        );
      }).toThrow('Invalid address format');
    });

    it('should throw on invalid SS58 format', () => {
      expect(() => {
        AddressTransformer.transform(
          '5InvalidSS58Format',
          'test',
          getChainProperties(Chain.Polkadot)
        );
      }).toThrow('Invalid address format');
    });

    it('should throw on wrong length SS58', () => {
      expect(() => {
        AddressTransformer.transform(
          POLKADOT_SS58.slice(0, 10),
          'test',
          getChainProperties(Chain.Polkadot)
        );
      }).toThrow('Invalid address format');
    });

    it('should throw on empty address', () => {
      expect(() => {
        AddressTransformer.transform(
          '',
          'test',
          getChainProperties(Chain.Polkadot)
        );
      }).toThrow('Invalid address format');
    });
  });

  describe('different chains support', () => {
    const chainAddresses = {
      [Chain.Polkadot]: POLKADOT_SS58,
      [Chain.Kusama]: KUSAMA_SS58,
      [Chain.PeoplePolkadot]: PEOPLE_POLKADOT_SS58,
      [Chain.PeopleKusama]: PEOPLE_KUSAMA_SS58
    };

    Object.entries(chainAddresses).forEach(([chain, expectedSS58]) => {
      it(`should handle ${chain} addresses`, () => {
        const chainProps = getChainProperties(chain as Chain);
        const result = AddressTransformer.transform(TEST_HEX, 'test', chainProps);
        
        expect(result.hex).toBe(TEST_HEX);
        expect(result.name).toBe('test');
        expect(result.ss58).toBe(expectedSS58);
      });
    });
  });
});