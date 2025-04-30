"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const util_crypto_1 = require("@polkadot/util-crypto");
const util_1 = require("@polkadot/util");
const config_processor_1 = require("../src/config-processor");
const monitoring_types_1 = require("@w3f/monitoring-types");
const path_1 = require("path");
const FIXTURES_DIR = path_1.default.join(__dirname, 'fixtures');
const TEST_HEX = '0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d';
const POLKADOT_SS58 = (0, util_crypto_1.encodeAddress)((0, util_1.hexToU8a)(TEST_HEX), (0, monitoring_types_1.getChainProperties)(monitoring_types_1.Chain.Polkadot).ss58Format);
const KUSAMA_SS58 = (0, util_crypto_1.encodeAddress)((0, util_1.hexToU8a)(TEST_HEX), (0, monitoring_types_1.getChainProperties)(monitoring_types_1.Chain.Kusama).ss58Format);
describe('ConfigProcessor', () => {
    describe('Valid Configurations', () => {
        it('should process full config with all features', () => {
            const result = config_processor_1.ConfigProcessor.processConfigs([path_1.default.join(FIXTURES_DIR, 'valid/full-config.yaml')]);
            expect(result.length).toBe(3);
            const polkadotGroups = result.filter(g => g.chain === monitoring_types_1.Chain.Polkadot);
            const kusamaGroups = result.filter(g => g.chain === monitoring_types_1.Chain.Kusama);
            expect(polkadotGroups.length).toBe(1);
            expect(kusamaGroups.length).toBe(2);
            const defaultGroup = result.find(g => g.id === 'validators-default' && g.chain === monitoring_types_1.Chain.Polkadot);
            expect(defaultGroup).toBeDefined();
            expect(defaultGroup?.notifications).toEqual({
                messengerType: 'matrix',
                channels: ['!defaultroom:matrix.org'],
                needsAck: true,
                repeatHours: 24,
            });
            const hexAccount = defaultGroup?.accounts.find(a => a.name === 'Bob-Hex');
            expect(hexAccount).toBeDefined();
            expect(hexAccount?.hex).toBe(TEST_HEX);
            expect(hexAccount?.ss58).toBe(POLKADOT_SS58);
            const customGroup = result.find(g => g.id === 'validators-custom' && g.chain === monitoring_types_1.Chain.Kusama);
            const bobAccount = customGroup?.accounts.find(a => a.name === 'Bob');
            expect(bobAccount).toBeDefined();
            expect(bobAccount?.[monitoring_types_1.MonitorType.Staking]).toEqual({
                commission: 3,
                selfStake: 1000500000000000n,
                handlers: [monitoring_types_1.StakingHandlerType.CommissionChanged, monitoring_types_1.StakingHandlerType.DestinationChanged],
            });
            expect(bobAccount?.[monitoring_types_1.MonitorType.Balances]).toMatchObject({
                threshold: 750250000000000n,
            });
            expect(bobAccount?.[monitoring_types_1.MonitorType.Balances].handlers).toBeDefined();
            expect(Array.isArray(bobAccount?.[monitoring_types_1.MonitorType.Balances].handlers)).toBe(true);
            expect(bobAccount?.[monitoring_types_1.MonitorType.Identity]).toMatchObject({
                matrix: '@validator:matrix.org',
                email: 'validator@email.com',
            });
            expect(bobAccount?.[monitoring_types_1.MonitorType.Identity].handlers).toBeDefined();
            expect(Array.isArray(bobAccount?.[monitoring_types_1.MonitorType.Identity].handlers)).toBe(true);
        });
        it('should process minimal valid config', () => {
            const result = config_processor_1.ConfigProcessor.processConfigs([path_1.default.join(FIXTURES_DIR, 'valid/minimal-config.yaml')]);
            expect(result.length).toBe(1);
            const group = result[0];
            expect(group.chain).toBe(monitoring_types_1.Chain.Polkadot);
            expect(group.accounts.length).toBe(1);
            const account = group.accounts[0];
            const monitorKeys = Object.keys(account).filter(key => Object.values(monitoring_types_1.MonitorType).includes(key));
            expect(monitorKeys).toContain(monitoring_types_1.MonitorType.Staking);
            expect(account[monitoring_types_1.MonitorType.Staking]).toMatchObject({
                commission: 10,
            });
            expect(account[monitoring_types_1.MonitorType.Staking].handlers).toBeDefined();
            expect(Array.isArray(account[monitoring_types_1.MonitorType.Staking].handlers)).toBe(true);
        });
        it('should handle same address across different chains', () => {
            const result = config_processor_1.ConfigProcessor.processConfigs([path_1.default.join(FIXTURES_DIR, 'valid/multi-chain-config.yaml')]);
            const polkadotGroup = result.find(g => g.chain === monitoring_types_1.Chain.Polkadot);
            const kusamaGroup = result.find(g => g.chain === monitoring_types_1.Chain.Kusama);
            const polkadotHexAccount = polkadotGroup?.accounts.find(a => a.name === 'Bob-Hex-Polkadot');
            const kusamaHexAccount = kusamaGroup?.accounts.find(a => a.name === 'Bob-Hex-Kusama');
            expect(polkadotHexAccount?.hex).toBe(TEST_HEX);
            expect(kusamaHexAccount?.hex).toBe(TEST_HEX);
            expect(polkadotHexAccount?.ss58).toBe(POLKADOT_SS58);
            expect(kusamaHexAccount?.ss58).toBe(KUSAMA_SS58);
            expect(polkadotHexAccount?.ss58).not.toBe(kusamaHexAccount?.ss58);
        });
    });
    describe('Invalid Configurations', () => {
        it('should throw on invalid structure', () => {
            expect(() => {
                config_processor_1.ConfigProcessor.processConfigs([path_1.default.join(FIXTURES_DIR, 'invalid/invalid-structure.yaml')]);
            }).toThrow(/groups/);
        });
        it('should throw on invalid address format', () => {
            expect(() => {
                config_processor_1.ConfigProcessor.processConfigs([path_1.default.join(FIXTURES_DIR, 'invalid/invalid-address.yaml')]);
            }).toThrow(/Invalid address format/);
        });
        it('should throw on invalid alert configuration', () => {
            expect(() => {
                config_processor_1.ConfigProcessor.processConfigs([path_1.default.join(FIXTURES_DIR, 'invalid/invalid-notifications.yaml')]);
            }).toThrow(/messengerType/);
        });
        it('should throw on invalid balance format', () => {
            expect(() => {
                config_processor_1.ConfigProcessor.processConfigs([path_1.default.join(FIXTURES_DIR, 'invalid/invalid-balance.yaml')]);
            }).toThrow(/Invalid decimal format/);
        });
        it('should throw when required defaults are missing', () => {
            expect(() => {
                config_processor_1.ConfigProcessor.processConfigs([path_1.default.join(FIXTURES_DIR, 'invalid/invalid-defaults.yaml')]);
            }).toThrow(/must have (monitors|notifications) defined/);
        });
        describe('Invalid Configurations', () => {
            describe('handler validation', () => {
                it('should throw on empty handlers array', () => {
                    expect(() => {
                        config_processor_1.ConfigProcessor.processConfigs([path_1.default.join(FIXTURES_DIR, 'invalid/invalid-handlers.yaml')]);
                    }).toThrow(/At least one handler is required/);
                });
                it('should throw on invalid handler type', () => {
                    expect(() => {
                        config_processor_1.ConfigProcessor.processConfigs([path_1.default.join(FIXTURES_DIR, 'invalid/invalid-handler-type.yaml')]);
                    }).toThrow(/Must be one of:/);
                });
            });
        });
    });
});
//# sourceMappingURL=config-processor.test.js.map