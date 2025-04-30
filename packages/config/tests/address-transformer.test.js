"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const address_transformer_1 = require("../src/address-transformer");
const monitoring_types_1 = require("@w3f/monitoring-types");
const util_crypto_1 = require("@polkadot/util-crypto");
const util_1 = require("@polkadot/util");
describe('AddressTransformer', () => {
    const TEST_HEX = '0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d';
    const POLKADOT_SS58 = (0, util_crypto_1.encodeAddress)((0, util_1.hexToU8a)(TEST_HEX), (0, monitoring_types_1.getChainProperties)(monitoring_types_1.Chain.Polkadot).ss58Format);
    const KUSAMA_SS58 = (0, util_crypto_1.encodeAddress)((0, util_1.hexToU8a)(TEST_HEX), (0, monitoring_types_1.getChainProperties)(monitoring_types_1.Chain.Kusama).ss58Format);
    const PEOPLE_POLKADOT_SS58 = (0, util_crypto_1.encodeAddress)((0, util_1.hexToU8a)(TEST_HEX), (0, monitoring_types_1.getChainProperties)(monitoring_types_1.Chain.PeoplePolkadot).ss58Format);
    const PEOPLE_KUSAMA_SS58 = (0, util_crypto_1.encodeAddress)((0, util_1.hexToU8a)(TEST_HEX), (0, monitoring_types_1.getChainProperties)(monitoring_types_1.Chain.PeopleKusama).ss58Format);
    describe('hex address input', () => {
        it('should transform hex to Polkadot SS58', () => {
            const result = address_transformer_1.AddressTransformer.transform(TEST_HEX, 'test', (0, monitoring_types_1.getChainProperties)(monitoring_types_1.Chain.Polkadot));
            expect(result.ss58).toBe(POLKADOT_SS58);
            expect(result.hex).toBe(TEST_HEX);
            expect(result.name).toBe('test');
        });
        it('should transform hex to Kusama SS58', () => {
            const result = address_transformer_1.AddressTransformer.transform(TEST_HEX, 'test', (0, monitoring_types_1.getChainProperties)(monitoring_types_1.Chain.Kusama));
            expect(result.ss58).toBe(KUSAMA_SS58);
            expect(result.hex).toBe(TEST_HEX);
        });
        it('should generate name from SS58 when name not provided', () => {
            const result = address_transformer_1.AddressTransformer.transform(TEST_HEX, undefined, (0, monitoring_types_1.getChainProperties)(monitoring_types_1.Chain.Polkadot));
            expect(result.name).toBe(`${POLKADOT_SS58.slice(0, 4)}...${POLKADOT_SS58.slice(-4)}`);
        });
    });
    describe('SS58 address input', () => {
        it('should maintain Polkadot SS58 when chain is Polkadot', () => {
            const result = address_transformer_1.AddressTransformer.transform(POLKADOT_SS58, 'test', (0, monitoring_types_1.getChainProperties)(monitoring_types_1.Chain.Polkadot));
            expect(result.ss58).toBe(POLKADOT_SS58);
            expect(result.hex).toBe(TEST_HEX);
            expect(result.name).toBe('test');
        });
        it('should transform Polkadot SS58 to Kusama format', () => {
            const result = address_transformer_1.AddressTransformer.transform(POLKADOT_SS58, 'test', (0, monitoring_types_1.getChainProperties)(monitoring_types_1.Chain.Kusama));
            expect(result.ss58).toBe(KUSAMA_SS58);
            expect(result.hex).toBe(TEST_HEX);
        });
        it('should transform Kusama SS58 to Polkadot format', () => {
            const result = address_transformer_1.AddressTransformer.transform(KUSAMA_SS58, 'test', (0, monitoring_types_1.getChainProperties)(monitoring_types_1.Chain.Polkadot));
            expect(result.ss58).toBe(POLKADOT_SS58);
            expect(result.hex).toBe(TEST_HEX);
        });
        it('should generate name from target chain SS58 when name not provided', () => {
            const result = address_transformer_1.AddressTransformer.transform(KUSAMA_SS58, undefined, (0, monitoring_types_1.getChainProperties)(monitoring_types_1.Chain.Polkadot));
            expect(result.name).toBe(`${POLKADOT_SS58.slice(0, 4)}...${POLKADOT_SS58.slice(-4)}`);
        });
    });
    describe('error handling', () => {
        it('should throw on invalid hex format', () => {
            expect(() => {
                address_transformer_1.AddressTransformer.transform('0xinvalid', 'test', (0, monitoring_types_1.getChainProperties)(monitoring_types_1.Chain.Polkadot));
            }).toThrow('Invalid address format');
        });
        it('should throw on invalid SS58 format', () => {
            expect(() => {
                address_transformer_1.AddressTransformer.transform('5InvalidSS58Format', 'test', (0, monitoring_types_1.getChainProperties)(monitoring_types_1.Chain.Polkadot));
            }).toThrow('Invalid address format');
        });
        it('should throw on wrong length SS58', () => {
            expect(() => {
                address_transformer_1.AddressTransformer.transform(POLKADOT_SS58.slice(0, 10), 'test', (0, monitoring_types_1.getChainProperties)(monitoring_types_1.Chain.Polkadot));
            }).toThrow('Invalid address format');
        });
        it('should throw on empty address', () => {
            expect(() => {
                address_transformer_1.AddressTransformer.transform('', 'test', (0, monitoring_types_1.getChainProperties)(monitoring_types_1.Chain.Polkadot));
            }).toThrow('Invalid address format');
        });
    });
    describe('different chains support', () => {
        const chainAddresses = {
            [monitoring_types_1.Chain.Polkadot]: POLKADOT_SS58,
            [monitoring_types_1.Chain.Kusama]: KUSAMA_SS58,
            [monitoring_types_1.Chain.PeoplePolkadot]: PEOPLE_POLKADOT_SS58,
            [monitoring_types_1.Chain.PeopleKusama]: PEOPLE_KUSAMA_SS58,
        };
        Object.entries(chainAddresses).forEach(([chain, expectedSS58]) => {
            it(`should handle ${chain} addresses`, () => {
                const chainProps = (0, monitoring_types_1.getChainProperties)(chain);
                const result = address_transformer_1.AddressTransformer.transform(TEST_HEX, 'test', chainProps);
                expect(result.hex).toBe(TEST_HEX);
                expect(result.name).toBe('test');
                expect(result.ss58).toBe(expectedSS58);
            });
        });
    });
});
//# sourceMappingURL=address-transformer.test.js.map