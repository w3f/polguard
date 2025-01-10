import { encodeAddress } from '@polkadot/util-crypto';
import { hexToU8a } from '@polkadot/util';
import { ConfigProcessor } from '../src/config-processor';
import { MonitorType, Chain, StakingHandlerType, getChainProperties, ComparisonType } from '@w3f/monitoring-types';
import path from 'path';

const FIXTURES_DIR = path.join(__dirname, 'fixtures');
const TEST_HEX = '0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d';
const POLKADOT_SS58 = encodeAddress(hexToU8a(TEST_HEX), getChainProperties(Chain.Polkadot).ss58Format)
const KUSAMA_SS58 = encodeAddress(hexToU8a(TEST_HEX), getChainProperties(Chain.Kusama).ss58Format)

describe('ConfigProcessor', () => {
  describe('Valid Configurations', () => {
    it('should process full config with all features', () => {
      const result = ConfigProcessor.processConfigs([
        path.join(FIXTURES_DIR, 'valid/full-config.yaml')
      ]);
    
      // Check groups distribution across chains
      expect(result.length).toBe(3); // validators-default for both chains + validators-custom for Kusama
      const polkadotGroups = result.filter(g => g.chain === Chain.Polkadot);
      const kusamaGroups = result.filter(g => g.chain === Chain.Kusama);
      expect(polkadotGroups.length).toBe(1); // validators-default only
      expect(kusamaGroups.length).toBe(2); // validators-default and validators-custom    

      // Test defaults inheritance
      const defaultGroup = result.find(g => g.name === 'validators-default' && g.chain === Chain.Polkadot);
      expect(defaultGroup).toBeDefined();
      expect(defaultGroup?.alerts).toEqual({
        messengerType: 'matrix',
        targets: ['!defaultroom:matrix.org'],
        acknowledgement: true,
        repeatIntervalHours: 24
      });

      // Test address transformation
      const hexAccount = defaultGroup?.accounts.find(a => a.name === 'Bob-Hex');
      expect(hexAccount).toBeDefined();
      expect(hexAccount?.hex).toBe(TEST_HEX);
      expect(hexAccount?.ss58).toBe(POLKADOT_SS58);

      // Test monitor settings merging and completeness
      const customGroup = result.find(g => g.name === 'validators-custom' && g.chain === Chain.Kusama);
      const bobAccount = customGroup?.accounts.find(a => a.name === 'Bob');
      expect(bobAccount).toBeDefined();
      
      // Check Staking monitor settings
      expect(bobAccount?.[MonitorType.Staking]).toEqual({
        commission: 3, // Overridden from account
        selfStake: 1000500000000000n, // Converted to BigInt
        commissionComparison: ComparisonType.LessThanOrEqual, // Default
        selfStakeComparison: ComparisonType.GreaterThanOrEqual, // Default
        handlers: {
          include: [
            StakingHandlerType.CommissionChanged,
            StakingHandlerType.DestinationChanged
          ]
        }
      });

      // Check Balances monitor settings
      expect(bobAccount?.[MonitorType.Balances]).toEqual({
        threshold: 750250000000000n // Converted to BigInt
      });

      // Check Identity monitor settings
      expect(bobAccount?.[MonitorType.Identity]).toEqual({
        matrix: '@validator:matrix.org',
        email: 'validator@email.com'
      });
    });

    it('should process minimal valid config', () => {
      const result = ConfigProcessor.processConfigs([
        path.join(FIXTURES_DIR, 'valid/minimal-config.yaml')
      ]);
    
      expect(result.length).toBe(1);
      const group = result[0];
      expect(group.chain).toBe(Chain.Polkadot);
      expect(group.accounts.length).toBe(1);
      
      const account = group.accounts[0];
      const monitorKeys = Object.keys(account).filter(key => 
        Object.values(MonitorType).includes(key as MonitorType)
      );
      
      // Should only have Staking monitor
      expect(monitorKeys).toEqual([MonitorType.Staking]);
      
      // Check Staking monitor settings
      expect(account[MonitorType.Staking]).toEqual({
        commission: 10,
        commissionComparison: ComparisonType.LessThanOrEqual,
        selfStakeComparison: ComparisonType.GreaterThanOrEqual
      });
    });

    it('should handle same address across different chains', () => {
      const result = ConfigProcessor.processConfigs([
        path.join(FIXTURES_DIR, 'valid/multi-chain-config.yaml')
      ]);

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
        ConfigProcessor.processConfigs([
          path.join(FIXTURES_DIR, 'invalid/invalid-structure.yaml')
        ]);
      }).toThrow(/groups/);
    });

    it('should throw on invalid address format', () => {
      expect(() => {
        ConfigProcessor.processConfigs([
          path.join(FIXTURES_DIR, 'invalid/invalid-address.yaml')
        ]);
      }).toThrow(/Invalid address format/);
    });

    it('should throw when staking monitor missing commission', () => {
      expect(() => {
        ConfigProcessor.processConfigs([
          path.join(FIXTURES_DIR, 'invalid/invalid-monitor.yaml')
        ]);
      }).toThrow(/Neither the Staking monitor nor account.*has a commission specified/);
    });

    it('should throw on invalid alert configuration', () => {
      expect(() => {
        ConfigProcessor.processConfigs([
          path.join(FIXTURES_DIR, 'invalid/invalid-alerts.yaml')
        ]);
      }).toThrow(/messengerType/);
    });

    it('should throw on invalid balance format', () => {
      expect(() => {
        ConfigProcessor.processConfigs([
          path.join(FIXTURES_DIR, 'invalid/invalid-balance.yaml')
        ]);
      }).toThrow(/Invalid decimal format/);
    });

    it('should throw when required defaults are missing', () => {
      expect(() => {
        ConfigProcessor.processConfigs([
          path.join(FIXTURES_DIR, 'invalid/invalid-defaults.yaml')
        ]);
      }).toThrow(/must have (monitors|alerts) defined/);
    });
  
    describe('Invalid Configurations', () => {
      describe('handler validation', () => {
        it('should throw on having both include and exclude', () => {
          expect(() => {
            ConfigProcessor.processConfigs([
              path.join(FIXTURES_DIR, 'invalid/invalid-handlers.yaml')
            ]);
          }).toThrow(/Cannot have both include and exclude arrays./);
        });
    
        it('should throw on invalid handler type', () => {
          expect(() => {
            ConfigProcessor.processConfigs([
              path.join(FIXTURES_DIR, 'invalid/invalid-handler-type.yaml')
            ]);
          }).toThrow(/Must be one of:/);
        });
      });
    });
  });
});