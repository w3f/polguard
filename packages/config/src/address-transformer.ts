import { AccountId, ChainProperties } from '@w3f/monitoring-types';
import { u8aToHex, hexToU8a, isHex } from '@polkadot/util';
import { decodeAddress, encodeAddress } from '@polkadot/util-crypto';

/**
 * Transforms and normalizes blockchain addresses across different formats and chains.
 *
 * This class is responsible for:
 * 1. Accepting either hex or SS58 address formats as input and ensuring both are in the output.
 * 2. Deriving a default name from the address if not provided.
 * 3. Recalculating the SS58 address for the specified chain, regardless of the input address's original chain.
 *
 * Example usage:
 *
 * // Using SS58 input from Kusama, but requesting Polkadot format
 * const kusamaSS58 = 'HNZata7iMYWmk5RvZRTiAsSDhV8366zq2YGb3tLH5Upf74F';
 * const result1 = AddressTransformer.transform(kusamaSS58, undefined, Chain.Polkadot);
 *
 * // Result1 will contain:
 * // {
 * //   name: '5Grw...utQY',
 * //   hex: '0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d',
 * //   ss58: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'
 * // }
 *
 * // Using hex input with a provided name, requesting Kusama format
 * const hexAddress = '0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d';
 * const result2 = AddressTransformer.transform(hexAddress, 'Alice', Chain.Kusama);
 *
 * // Result2 will contain:
 * // {
 * //   name: 'Alice',
 * //   hex: '0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d',
 * //   ss58: 'HNZata7iMYWmk5RvZRTiAsSDhV8366zq2YGb3tLH5Upf74F'
 * // }
 */
export class AddressTransformer {
  static transform(address: string, name: string | undefined, chainProps: ChainProperties): AccountId {
    const hex = this.addressToHex(address);
    const ss58 = encodeAddress(hexToU8a(hex), chainProps.ss58Format);
    return {
      name: name || `${ss58.slice(0, 4)}...${ss58.slice(-4)}`,
      hex,
      ss58,
    };
  }

  private static addressToHex(address: string): string {
    if (isHex(address)) {
      return address;
    }
    try {
      return u8aToHex(decodeAddress(address));
    } catch {
      throw new Error(`Invalid address format: ${address}`);
    }
  }

}
