import { encodeAddress } from '@polkadot/util-crypto';
import { ConfigTransformer } from '../transformer';
import { RawMonitoringGroup } from '../interfaces';
import { Chain, MonitorType } from '../../constants';

describe('ConfigTransformer', () => {
  it('should transform valid raw groups into monitoring groups', () => {
    const rawGroups: RawMonitoringGroup[] = [
      {
        name: 'TestGroup',
        chains: ['polkadot'],
        monitors: [{ name: 'validator', commission: 10 }],
        accounts: [{ name: 'TestAccount', address: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY' }],
        alerts: { matrix: { rooms: ['!test:matrix.org'] } }
      }
    ];

    const result = ConfigTransformer.transformGroups(rawGroups);

    const expectedSs58 = encodeAddress('0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d', 0); // 0 is Polkadot's prefix

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      name: 'TestGroup',
      chains: [Chain.Polkadot],
      monitors: [{ name: MonitorType.Validator, commission: 10 }],
      accounts: [{ 
        name: 'TestAccount', 
        ss58: expectedSs58,
        hex: '0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d'
      }],
      alerts: { matrix: { rooms: ['!test:matrix.org'] } }
    });
  });

  it('should throw an error for invalid chain', () => {
    const rawGroups: RawMonitoringGroup[] = [
      {
        name: 'TestGroup',
        chains: ['invalid_chain'],
        monitors: [],
        accounts: [],
        alerts: { matrix: { rooms: ['!test:matrix.org'] } }
      }
    ];

    expect(() => ConfigTransformer.transformGroups(rawGroups)).toThrow('Invalid chain: invalid_chain');
  });
});
