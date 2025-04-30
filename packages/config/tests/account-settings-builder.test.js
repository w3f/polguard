"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const monitoring_types_1 = require("@w3f/monitoring-types");
const account_settings_builder_1 = require("../src/account-settings-builder");
const config_validator_1 = require("../src/config-validator");
describe('AccountSettingsBuilder', () => {
    describe('buildSettings', () => {
        it('should merge monitor and account settings', () => {
            const monitorConfigs = [
                {
                    name: monitoring_types_1.MonitorType.Staking,
                    settings: {
                        commission: 10,
                        handlers: [monitoring_types_1.StakingHandlerType.CommissionChanged],
                    },
                },
            ];
            const accountSettings = {
                commission: 5,
                selfStake: '1000.5',
            };
            const chainProps = {
                chain: monitoring_types_1.Chain.Polkadot,
                specName: 'polkadot',
                chainDecimals: 10,
                chainToken: 'DOT',
                ss58Format: 0,
            };
            const result = account_settings_builder_1.AccountSettingsBuilder.buildSettings(monitorConfigs, accountSettings, chainProps);
            expect(result).toHaveProperty(monitoring_types_1.MonitorType.Staking);
            expect(result[monitoring_types_1.MonitorType.Staking]).toEqual({
                commission: 5,
                selfStake: 10005000000000n,
                handlers: [monitoring_types_1.StakingHandlerType.CommissionChanged],
            });
        });
        it('should only include settings for configured monitors', () => {
            const monitorConfigs = [
                {
                    name: monitoring_types_1.MonitorType.Staking,
                    settings: {
                        commission: 10,
                        handlers: [monitoring_types_1.StakingHandlerType.ActiveSetPresence],
                    },
                },
            ];
            const accountSettings = {
                commission: 5,
                matrix: '@me:matrix.org',
            };
            const chainProps = {
                chain: monitoring_types_1.Chain.Polkadot,
                specName: 'polkadot',
                chainDecimals: 10,
                chainToken: 'DOT',
                ss58Format: 0,
            };
            const result = account_settings_builder_1.AccountSettingsBuilder.buildSettings(monitorConfigs, accountSettings, chainProps);
            expect(Object.keys(result)).toEqual([monitoring_types_1.MonitorType.Staking]);
            expect(result).not.toHaveProperty(monitoring_types_1.MonitorType.Identity);
        });
        it('should convert decimal balances to BigInt', () => {
            const monitorConfigs = [
                {
                    name: monitoring_types_1.MonitorType.Balances,
                    settings: {
                        threshold: '100.22',
                    },
                },
            ];
            const accountSettings = {};
            const chainProps = {
                chain: monitoring_types_1.Chain.Polkadot,
                specName: 'polkadot',
                chainDecimals: 10,
                chainToken: 'DOT',
                ss58Format: 0,
            };
            const result = account_settings_builder_1.AccountSettingsBuilder.buildSettings(monitorConfigs, accountSettings, chainProps);
            expect(result[monitoring_types_1.MonitorType.Balances]).toHaveProperty('threshold', 1002200000000n);
        });
    });
    describe('Schema Utilities', () => {
        it('extractFieldsFromSchema should return all field names from a schema', () => {
            const fields = (0, config_validator_1.extractFieldsFromSchema)(config_validator_1.monitorSchemas[monitoring_types_1.MonitorType.Staking]);
            expect(fields).toContain('commission');
            expect(fields).toContain('selfStake');
            expect(fields).toContain('payee');
            expect(fields).toContain('handlers');
        });
    });
});
//# sourceMappingURL=account-settings-builder.test.js.map