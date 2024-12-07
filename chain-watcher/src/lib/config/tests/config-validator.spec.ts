import { validateConfig } from '../config-validator';
import { Chain, MonitorType } from '../../constants';

describe('validateConfig', () => {
  const validFullConfig = {
    defaults: {
      chains: [Chain.Polkadot],
      monitors: [{ name: MonitorType.Validator, commission: 10 }],
      alerts: { matrix: { targets: ['!example:example.com'] } },
    },
    groups: [
      {
        name: 'Test Group',
        accounts: [{ address: '0x1234567890123456789012345678901234567890123456789012345678901234' }],
      },
    ],
  };

  const validMinimalConfig = {
    groups: [
      {
        name: 'Test Group',
        chains: [Chain.Polkadot],
        monitors: [{ name: MonitorType.Validator, commission: 10 }],
        alerts: { matrix: { targets: ['!example:example.com'] } },
        accounts: [{ address: '0x1234567890123456789012345678901234567890123456789012345678901234' }],
      },
    ],
  };

  describe('Group validation', () => {
    it('should throw when no groups are provided', () => {
      const configWithNoGroups = { ...validFullConfig, groups: [] };
      expect(() => validateConfig(configWithNoGroups)).toThrow();
    });
  });

  describe('Config without defaults', () => {
    it('should validate successfully with all required fields in groups', () => {
      expect(() => validateConfig(validMinimalConfig)).not.toThrow();
    });

    it('should throw when chains are missing in a group', () => {
      const configWithoutChains = {
        groups: [{ ...validMinimalConfig.groups[0], chains: undefined }],
      };
      expect(() => validateConfig(configWithoutChains)).toThrow();
    });

    it('should throw when monitors are missing in a group', () => {
      const configWithoutMonitors = {
        groups: [{ ...validMinimalConfig.groups[0], monitors: undefined }],
      };
      expect(() => validateConfig(configWithoutMonitors)).toThrow();
    });

    it('should throw when alerts are missing in a group', () => {
      const configWithoutAlerts = {
        groups: [{ ...validMinimalConfig.groups[0], alerts: undefined }],
      };
      expect(() => validateConfig(configWithoutAlerts)).toThrow();
    });
  });

  describe('Config with defaults', () => {
    it('should validate successfully with all required fields in defaults', () => {
      expect(() => validateConfig(validFullConfig)).not.toThrow();
    });

    it('should throw when chains are missing in defaults and groups', () => {
      const configWithoutChains = {
        defaults: { ...validFullConfig.defaults, chains: undefined },
        groups: [{ ...validFullConfig.groups[0], chains: undefined }],
      };
      expect(() => validateConfig(configWithoutChains)).toThrow();
    });

    it('should throw when monitors are missing in defaults and groups', () => {
      const configWithoutMonitors = {
        defaults: { ...validFullConfig.defaults, monitors: undefined },
        groups: [{ ...validFullConfig.groups[0], monitors: undefined }],
      };
      expect(() => validateConfig(configWithoutMonitors)).toThrow();
    });

    it('should throw when alerts are missing in defaults and groups', () => {
      const configWithoutAlerts = {
        defaults: { ...validFullConfig.defaults, alerts: undefined },
        groups: [{ ...validFullConfig.groups[0], alerts: undefined }],
      };
      expect(() => validateConfig(configWithoutAlerts)).toThrow();
    });
  });

  describe('Account validation', () => {
    it('should validate successfully with a valid address', () => {
      expect(() => validateConfig(validMinimalConfig)).not.toThrow();
    });

    it('should throw when address is missing', () => {
      const configWithMissingAddress = {
        ...validMinimalConfig,
        groups: [
          {
            ...validMinimalConfig.groups[0],
            accounts: [{}],
          },
        ],
      };
      expect(() => validateConfig(configWithMissingAddress)).toThrow();
    });

    it('should throw when address format is invalid', () => {
      const configWithInvalidAddress = {
        ...validMinimalConfig,
        groups: [
          {
            ...validMinimalConfig.groups[0],
            accounts: [{ address: 'invalid-address' }],
          },
        ],
      };
      expect(() => validateConfig(configWithInvalidAddress)).toThrow();
    });
  });

  describe('Validator monitor validation', () => {
    it('should throw when commission is missing for Validator monitor', () => {
      const configWithoutCommission = {
        ...validMinimalConfig,
        groups: [
          {
            ...validMinimalConfig.groups[0],
            monitors: [{ name: MonitorType.Validator }],
          },
        ],
      };
      expect(() => validateConfig(configWithoutCommission)).toThrow();
    });

    it('should validate successfully when commission is provided in account', () => {
      const configWithAccountCommission = {
        ...validMinimalConfig,
        groups: [
          {
            ...validMinimalConfig.groups[0],
            monitors: [{ name: MonitorType.Validator }],
            accounts: [
              {
                address: '0x1234567890123456789012345678901234567890123456789012345678901234',
                commission: 5,
              },
            ],
          },
        ],
      };
      expect(() => validateConfig(configWithAccountCommission)).not.toThrow();
    });
  });

  describe('Matrix target validation', () => {
    it('should throw when Matrix target format is invalid', () => {
      const configWithInvalidMatrixTarget = {
        ...validMinimalConfig,
        groups: [
          {
            ...validMinimalConfig.groups[0],
            alerts: { matrix: { targets: ['invalid-target'] } },
          },
        ],
      };
      expect(() => validateConfig(configWithInvalidMatrixTarget)).toThrow();
    });

    it('should throw when no Matrix targets are provided', () => {
      const configWithNoMatrixTargets = {
        ...validMinimalConfig,
        groups: [
          {
            ...validMinimalConfig.groups[0],
            alerts: { matrix: { targets: [] } },
          },
        ],
      };
      expect(() => validateConfig(configWithNoMatrixTargets)).toThrow();
    });
  });

  describe('Monitor type validation', () => {
    it('should throw when an invalid monitor type is provided', () => {
      const configWithInvalidMonitorType = {
        ...validMinimalConfig,
        groups: [
          {
            ...validMinimalConfig.groups[0],
            monitors: [{ name: 'InvalidMonitorType' }],
          },
        ],
      };
      expect(() => validateConfig(configWithInvalidMonitorType)).toThrow();
    });
  });
});
