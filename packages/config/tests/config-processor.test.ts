import { encodeAddress } from '@polkadot/util-crypto';
import { hexToU8a } from '@polkadot/util';
import { ConfigProcessor } from '../src/config-processor';
import { MonitorType, Chain, StakingHandlerType, getChainProperties, MessengerType } from '@w3f/monitoring-types';
import path from 'path';

const FIXTURES_DIR = path.join(__dirname, 'fixtures');
const TEST_HEX = '0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d';
const POLKADOT_SS58 = encodeAddress(hexToU8a(TEST_HEX), getChainProperties(Chain.Polkadot).ss58Format);
const KUSAMA_SS58 = encodeAddress(hexToU8a(TEST_HEX), getChainProperties(Chain.Kusama).ss58Format);

describe('ConfigProcessor', () => {
  describe('Valid Configurations', () => {
    it('should process full config with all features', () => {
      const result = ConfigProcessor.processConfigs([path.join(FIXTURES_DIR, 'valid/full-config.yaml')]);

      // Check groups distribution across chains
      expect(result.length).toBe(3); // validators-default for both chains + validators-custom for Kusama
      const polkadotGroups = result.filter(g => g.chain === Chain.Polkadot);
      const kusamaGroups = result.filter(g => g.chain === Chain.Kusama);
      expect(polkadotGroups.length).toBe(1); // validators-default only
      expect(kusamaGroups.length).toBe(2); // validators-default and validators-custom

      // Test defaults inheritance
      const defaultGroup = result.find(g => g.id === 'validators-default' && g.chain === Chain.Polkadot);
      expect(defaultGroup).toBeDefined();
      expect(defaultGroup?.notifications).toEqual({
        messengerType: MessengerType.Matrix,
        channels: ['!defaultroom:matrix.org'],
        needsAck: true,
        repeatFiringMs: 3600,
      });

      // Test group-level annotations
      expect(defaultGroup?.annotations).toEqual({
        enablePayout: true,
      });

      // Test address transformation
      const hexAccount = defaultGroup?.accounts.find(a => a.name === 'Bob-Hex');
      expect(hexAccount).toBeDefined();
      expect(hexAccount?.hex).toBe(TEST_HEX);
      expect(hexAccount?.ss58).toBe(POLKADOT_SS58);

      // Test monitor settings merging and completeness
      const customGroup = result.find(g => g.id === 'validators-custom' && g.chain === Chain.Kusama);
      const bobAccount = customGroup?.accounts.find(a => a.name === 'Bob');
      expect(bobAccount).toBeDefined();

      // Check Staking monitor settings
      expect(bobAccount?.[MonitorType.Staking]).toEqual({
        commission: 3, // Overridden from account
        selfStake: 1000500000000000n, // Converted to BigInt
        handlers: [StakingHandlerType.CommissionChangedEvent, StakingHandlerType.DestinationChangedCall],
        annotations: {
          tag: 'group-R', // Overridden from account
        },
      });

      // Check Balances monitor settings
      expect(bobAccount?.[MonitorType.Balances]).toMatchObject({
        threshold: 750250000000000n, // Converted to BigInt
      });
      expect(bobAccount?.[MonitorType.Balances].handlers).toBeDefined();
      expect(Array.isArray(bobAccount?.[MonitorType.Balances].handlers)).toBe(true);

      // Check Identity monitor settings
      expect(bobAccount?.[MonitorType.Identity]).toMatchObject({
        matrix: '@validator:matrix.org',
        email: 'validator@email.com',
      });
      expect(bobAccount?.[MonitorType.Identity].handlers).toBeDefined();
      expect(Array.isArray(bobAccount?.[MonitorType.Identity].handlers)).toBe(true);
      expect(bobAccount?.[MonitorType.Identity].annotations).toEqual({
        tag: 'group-R',
      });
    });

    it('should process minimal valid config', () => {
      const result = ConfigProcessor.processConfigs([path.join(FIXTURES_DIR, 'valid/minimal-config.yaml')]);

      expect(result.length).toBe(1);
      const group = result[0];
      expect(group.chain).toBe(Chain.Polkadot);
      expect(group.accounts.length).toBe(1);

      const account = group.accounts[0];
      const monitorKeys = Object.keys(account).filter(key => Object.values(MonitorType).includes(key as MonitorType));

      // Should have Staking and Xcm monitors
      expect(monitorKeys).toContain(MonitorType.Staking);

      // Check Staking monitor settings
      expect(account[MonitorType.Staking]).toMatchObject({
        commission: 10,
      });
      expect(account[MonitorType.Staking].handlers).toBeDefined();
      expect(Array.isArray(account[MonitorType.Staking].handlers)).toBe(true);
    });

    it('should handle same address across different chains', () => {
      const result = ConfigProcessor.processConfigs([path.join(FIXTURES_DIR, 'valid/multi-chain-config.yaml')]);

      const polkadotGroup = result.find(g => g.chain === Chain.Polkadot);
      const kusamaGroup = result.find(g => g.chain === Chain.Kusama);

      const polkadotHexAccount = polkadotGroup?.accounts.find(a => a.name === 'Bob-Hex-Polkadot');
      const kusamaHexAccount = kusamaGroup?.accounts.find(a => a.name === 'Bob-Hex-Kusama');

      // Check address transformations
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
        ConfigProcessor.processConfigs([path.join(FIXTURES_DIR, 'invalid/invalid-structure.yaml')]);
      }).toThrow(/groups/);
    });

    it('should throw on invalid address format', () => {
      expect(() => {
        ConfigProcessor.processConfigs([path.join(FIXTURES_DIR, 'invalid/invalid-address.yaml')]);
      }).toThrow(/Invalid address format/);
    });

    it('should throw on invalid alert configuration', () => {
      expect(() => {
        ConfigProcessor.processConfigs([path.join(FIXTURES_DIR, 'invalid/invalid-notifications.yaml')]);
      }).toThrow(/messengerType/);
    });

    it('should throw on invalid balance format', () => {
      expect(() => {
        ConfigProcessor.processConfigs([path.join(FIXTURES_DIR, 'invalid/invalid-balance.yaml')]);
      }).toThrow(/Invalid decimal format/);
    });

    it('should throw when required defaults are missing', () => {
      expect(() => {
        ConfigProcessor.processConfigs([path.join(FIXTURES_DIR, 'invalid/invalid-defaults.yaml')]);
      }).toThrow(/must have (monitors|notifications) defined/);
    });

    describe('Invalid Configurations', () => {
      describe('handler validation', () => {
        it('should throw on empty handlers array', () => {
          expect(() => {
            ConfigProcessor.processConfigs([path.join(FIXTURES_DIR, 'invalid/invalid-handlers.yaml')]);
          }).toThrow(/At least one handler is required/);
        });

        it('should throw on invalid handler type', () => {
          expect(() => {
            ConfigProcessor.processConfigs([path.join(FIXTURES_DIR, 'invalid/invalid-handler-type.yaml')]);
          }).toThrow(/Must be one of:/);
        });
      });
    });
  });
});
