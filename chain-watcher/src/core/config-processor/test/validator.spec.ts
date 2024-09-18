import { ConfigValidator } from '../validator';
import { RawConfig } from '../interfaces';
import * as fs from 'fs';
import * as yaml from 'js-yaml';

jest.mock('fs');
jest.mock('js-yaml');

describe('ConfigValidator', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (fs.readFileSync as jest.Mock).mockReturnValue('mock file contents');
  });

  it('should validate a correct config file', () => {
    const mockConfig: RawConfig = {
      version: '1.0',
      defaults: {
        alerts: { matrix: { rooms: ['!default:matrix.org'] } }
      },
      groups: [
        {
          name: 'TestGroup',
          chains: ['polkadot'],
          monitors: [{ name: 'validator', commission: 10 }],
          accounts: [{ name: 'TestAccount', address: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY' }],
          alerts: { matrix: { rooms: ['!test:matrix.org'] } }
        }
      ]
    };

    (yaml.load as jest.Mock).mockReturnValue(mockConfig);

    const result = ConfigValidator.validate('/mock/config.yaml');

    expect(result).toEqual(mockConfig);
  });

  it('should throw an error for missing required fields', () => {
    const mockConfig = {
      version: '1.0',
      // Missing defaults and groups
    };

    (yaml.load as jest.Mock).mockReturnValue(mockConfig);

    expect(() => ConfigValidator.validate('/mock/config.yaml')).toThrow('Missing required key: defaults');
  });
});
