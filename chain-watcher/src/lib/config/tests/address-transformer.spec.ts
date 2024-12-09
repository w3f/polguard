import { AddressTransformer } from '../address-transformer';
import { Chain } from '../../constants';

describe('AddressTransformer', () => {
  const testCases = [
    {
      description: 'should transform Polkadot SS58 address',
      input: {
        address: '15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5',
        name: 'Alice',
        chain: Chain.Polkadot,
      },
      expected: {
        name: 'Alice',
        ss58: '15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5',
        hex: '0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d',
      },
    },
    {
      description: 'should transform Kusama SS58 address',
      input: {
        address: 'HNZata7iMYWmk5RvZRTiAsSDhV8366zq2YGb3tLH5Upf74F',
        name: undefined,
        chain: Chain.Kusama,
      },
      expected: {
        name: 'HNZa...f74F',
        ss58: 'HNZata7iMYWmk5RvZRTiAsSDhV8366zq2YGb3tLH5Upf74F',
        hex: '0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d',
      },
    },
    {
      description: 'should transform hex address to Polkadot SS58',
      input: {
        address: '0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d',
        name: 'Bob',
        chain: Chain.Polkadot,
      },
      expected: {
        name: 'Bob',
        ss58: '15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5',
        hex: '0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d',
      },
    },
  ];

  testCases.forEach(({ description, input, expected }) => {
    it(description, () => {
      const result = AddressTransformer.transform(input.address, input.name, input.chain);
      expect(result).toEqual(expected);
    });
  });

  it('should throw an error for invalid address', () => {
    expect(() => AddressTransformer.transform('invalid-address', 'Invalid', Chain.Polkadot)).toThrow(
      'Invalid address format',
    );
  });
});
