import { ConfigProcessor } from '../processor';
import { ConfigValidator } from '../validator';
import { ConfigTransformer } from '../transformer';
import { RawConfig } from '../interfaces';
import { MonitoringGroup } from '../../interfaces';
import { Chain } from '../../constants';

jest.mock('./validator');
jest.mock('./transformer');

describe('ConfigProcessor', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(ConfigProcessor as any, 'findConfigFiles').mockImplementation(() => []);
  });

  it('should process config files successfully', () => {
    const mockRawConfig: RawConfig = {
      version: '1.0',
      defaults: { alerts: { matrix: { rooms: ['!default:matrix.org'] } } },
      groups: [{ name: 'TestGroup', chains: ['polkadot'], monitors: [], accounts: [] }]
    };

    const mockMonitoringGroup: MonitoringGroup = {
      name: 'TestGroup',
      chains: [Chain.Polkadot],
      monitors: [],
      accounts: [],
      alerts: { matrix: { rooms: ['!default:matrix.org'] } }
    };

    (ConfigProcessor as any).findConfigFiles.mockReturnValue(['config.yaml']);
    (ConfigValidator.validate as jest.Mock).mockReturnValue(mockRawConfig);
    (ConfigTransformer.transformGroups as jest.Mock).mockReturnValue([mockMonitoringGroup]);

    const result = ConfigProcessor.process('/mock/config/dir');

    expect(result).toEqual([mockMonitoringGroup]);
    expect(ConfigValidator.validate).toHaveBeenCalledTimes(1);
    expect(ConfigTransformer.transformGroups).toHaveBeenCalledTimes(1);
  });

  it('should throw an error if no config files are found', () => {
    (ConfigProcessor as any).findConfigFiles.mockReturnValue([]);

    expect(() => ConfigProcessor.process('/mock/config/dir')).toThrow('No YAML config files found');
  });
});
