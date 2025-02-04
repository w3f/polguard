import { Chain, MessengerType, MonitorType } from '@w3f/monitoring-types';
import { TelemetryExporter } from '../../src/lib/telemetry-exporter';
import Redis from 'ioredis';
import axios from 'axios';

jest.mock('ioredis');
jest.mock('axios');
jest.mock('@w3f/substrate-telemetry-client', () => ({
  TelemetryClient: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    subscribe: jest.fn(),
    getNodesFiltered: jest.fn().mockReturnValue([
      {
        name: 'node-1',
        networkInfo: { ip: '1.2.3.4' }
      }
    ]),
    disconnect: jest.fn()
  })),
  CHAIN_GENESIS: {
    POLKADOT: '0x1',
    KUSAMA: '0x2'
  }
}));

describe('TelemetryExporter', () => {
  let mockRedis: jest.Mocked<Redis>;
  const mockAxios = axios as jest.Mocked<typeof axios>;

  beforeEach(() => {
    mockRedis = {
      get: jest.fn(),
      set: jest.fn(),
      quit: jest.fn()
    } as any;

    mockAxios.get.mockReset();
  });

  describe('node extraction', () => {
    it('should extract node names from monitoring groups', () => {
      const mockGroups = [
        {
          name: 'polkadot-group',
          chain: Chain.Polkadot,
          monitors: [{ name: MonitorType.Telemetry }],
          accounts: [
            { name: 'node-1', ss58: '0x1', hex: '0x1' },
            { name: 'node-2', ss58: '0x2', hex: '0x2' }
          ],
          alerts: {
            messengerType: MessengerType.Matrix,
            targets: ['test-room']
          }
        },
        {
          name: 'kusama-group',
          chain: Chain.Kusama,
          monitors: [{ name: MonitorType.Telemetry }],
          accounts: [
            { name: 'node-3', ss58: '0x3', hex: '0x3' }
          ],
          alerts: {
            messengerType: MessengerType.Matrix,
            targets: ['test-room']
          }
        }
      ];

      expect(() => new TelemetryExporter(mockGroups, mockRedis, 'token')).not.toThrow();
    });

    it('should throw error if no telemetry monitor found', () => {
      const mockGroups = [
        {
          name: 'polkadot-group',
          chain: Chain.Polkadot,
          monitors: [{ name: MonitorType.Balances }],
          accounts: [{ name: 'node-1', ss58: '0x1', hex: '0x1' }],
          alerts: {
            messengerType: MessengerType.Matrix,
            targets: ['test-room']
          }
        }
      ];

      expect(() => new TelemetryExporter(mockGroups, mockRedis, 'token'))
        .toThrow('No Telemetry monitor found for Polkadot chain');
    });

    it('should throw error if no nodes found', () => {
      const mockGroups = [
        {
          name: 'polkadot-group',
          chain: Chain.Polkadot,
          monitors: [{ name: MonitorType.Telemetry }],
          accounts: [],
          alerts: {
            messengerType: MessengerType.Matrix,
            targets: ['test-room']
          }
        }
      ];

      expect(() => new TelemetryExporter(mockGroups, mockRedis, 'token'))
        .toThrow('No nodes found for Polkadot chain telemetry monitoring');
    });
  });

  describe('location handling', () => {
    const mockGroups = [
      {
        name: 'polkadot-group',
        chain: Chain.Polkadot,
        monitors: [{ name: MonitorType.Telemetry }],
        accounts: [{ name: 'node-1', ss58: '0x1', hex: '0x1' }],
        alerts: {
          messengerType: MessengerType.Matrix,
          targets: ['test-room']
        }
      },
      {
        name: 'kusama-group',
        chain: Chain.Kusama,
        monitors: [{ name: MonitorType.Telemetry }],
        accounts: [{ name: 'node-2', ss58: '0x2', hex: '0x2' }],
        alerts: {
          messengerType: MessengerType.Matrix,
          targets: ['test-room']
        }
      }
    ];

    const mockLocationInfo = {
      ip: '1.2.3.4',
      city: 'Berlin',
      loc: '52.5200,13.4050',
      org: 'AWS'
    };

    it('should use cached location if available', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify(mockLocationInfo));
      
      const exporter = new TelemetryExporter(mockGroups, mockRedis, 'token');
      await exporter.start();
      const nodes = await exporter.getNodeStates(Chain.Polkadot);

      expect(mockAxios.get).not.toHaveBeenCalled();
      expect(nodes[0].location).toEqual({
        city: 'Berlin',
        latitude: 52.52,
        longitude: 13.405,
        provider: 'AWS'
      });
    });

    it('should fetch and cache location if not cached', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockAxios.get.mockResolvedValue({ data: mockLocationInfo });
      
      const exporter = new TelemetryExporter(mockGroups, mockRedis, 'token');
      await exporter.start();
      const nodes = await exporter.getNodeStates(Chain.Polkadot);

      expect(mockAxios.get).toHaveBeenCalledWith(
        'https://ipinfo.io/1.2.3.4',
        expect.any(Object)
      );
      expect(mockRedis.set).toHaveBeenCalledWith(
        'location:1.2.3.4',
        JSON.stringify(mockLocationInfo),
        'EX',
        expect.any(Number)
      );
      expect(nodes[0].location).toEqual({
        city: 'Berlin',
        latitude: 52.52,
        longitude: 13.405,
        provider: 'AWS'
      });
    });

    it('should pre-cache locations for all nodes', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockAxios.get.mockResolvedValue({ data: mockLocationInfo });
      
      const exporter = new TelemetryExporter(mockGroups, mockRedis, 'token');
      await exporter.start();
      await exporter.preCacheLocations();

      expect(mockAxios.get).toHaveBeenCalledWith(
        'https://ipinfo.io/1.2.3.4',
        expect.any(Object)
      );
      expect(mockRedis.set).toHaveBeenCalledWith(
        'location:1.2.3.4',
        JSON.stringify(mockLocationInfo),
        'EX',
        expect.any(Number)
      );
    });
  });
});
