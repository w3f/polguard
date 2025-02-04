import { Chain, MonitoringGroup, MonitorType } from '@w3f/monitoring-types';
import { NodeInfo, TelemetryClient, CHAIN_GENESIS } from '@w3f/substrate-telemetry-client';
import Redis from 'ioredis';
import axios, { AxiosError } from 'axios';

interface IpInfoResponse {
  ip: string;
  city?: string;
  region?: string;
  country?: string;
  loc?: string;
  org?: string;
  postal?: string;
  timezone?: string;
}

interface NodeLocation {
  latitude?: number;
  longitude?: number;
  city?: string;
  provider?: string;
}

export class TelemetryExporter {
  private readonly clients: { [key in Chain.Polkadot | Chain.Kusama]: TelemetryClient } = {
    [Chain.Polkadot]: new TelemetryClient(),
    [Chain.Kusama]: new TelemetryClient(),
  };
  private readonly nodeNames: { [key in Chain.Polkadot | Chain.Kusama]: Set<string> } = {
    [Chain.Polkadot]: new Set(),
    [Chain.Kusama]: new Set(),
  };
  private initialized = false;

  constructor(
    private readonly monitoringGroups: MonitoringGroup[],
    private readonly redis: Redis,
    private readonly ipinfoToken: string,
    private readonly locationCacheTtl: number = 43200, // 12 hours in seconds
  ) {
    this.extractNodeNames();
  }

  private extractNodeNames() {
    for (const chain of [Chain.Polkadot, Chain.Kusama]) {
      const chainGroups = this.monitoringGroups.filter(group => group.chain.includes(chain));
      let hasTelemetryMonitor = false;

      for (const group of chainGroups) {
        if (group.monitors.some(monitor => monitor.name === MonitorType.Telemetry)) {
          hasTelemetryMonitor = true;
          group.accounts.forEach(account => this.nodeNames[chain].add(account.name));
        }
      }
      if (!hasTelemetryMonitor) {
        throw new Error(`No Telemetry monitor found for ${chain} chain`);
      }
      if (this.nodeNames[chain].size === 0) {
        throw new Error(`No nodes found for ${chain} chain telemetry monitoring`);
      }
    }
  }

  async start() {
    await this.initializeClients();
    this.initialized = true;
  }

  async stop() {
    for (const client of Object.values(this.clients)) {
      client?.disconnect();
    }
  }

  private async initializeClients() {
    await this.clients[Chain.Polkadot].connect();
    this.clients[Chain.Polkadot].subscribe(CHAIN_GENESIS.POLKADOT);

    await this.clients[Chain.Kusama].connect();
    this.clients[Chain.Kusama].subscribe(CHAIN_GENESIS.KUSAMA);
  }

  async preCacheLocations() {
    for (const chain of [Chain.Polkadot, Chain.Kusama]) {
      const nodes = this.clients[chain].getNodesFiltered(node => this.nodeNames[chain].has(node.name));

      for (const node of nodes) {
        if (node.networkInfo?.ip) {
          await this.getLocationInfo(node.networkInfo.ip);
        }
      }
    }
  }

  private async getLocationInfo(ip: string): Promise<IpInfoResponse> {
    const cached = await this.redis.get(`location:${ip}`);
    if (cached) {
      return JSON.parse(cached);
    }

    try {
      const response = await axios.get<IpInfoResponse>(`https://ipinfo.io/${ip}`, {
        headers: { Authorization: `Bearer ${this.ipinfoToken}` },
      });

      await this.redis.set(`location:${ip}`, JSON.stringify(response.data), 'EX', this.locationCacheTtl);

      return response.data;
    } catch (error) {
      if (error instanceof AxiosError && (error.response?.status === 401 || error.response?.status === 403)) {
        throw new Error('Invalid IpInfo token. Please check your configuration.');
      }
      throw error;
    }
  }

  private parseLocation(info: IpInfoResponse): NodeLocation {
    const result: NodeLocation = {};

    if (info.loc) {
      const [lat, lon] = info.loc.split(',').map(Number);
      if (!isNaN(lat) && !isNaN(lon)) {
        result.latitude = lat;
        result.longitude = lon;
      }
    }

    if (info.city) {
      result.city = info.city;
    }

    if (info.org) {
      result.provider = info.org;
    }

    return result;
  }

  async getNodeStates(chain: Chain.Polkadot | Chain.Kusama): Promise<NodeInfo[]> {
    if (!this.initialized) {
      throw new Error('Telemetry exporter not yet initialized');
    }
    const nodes = this.clients[chain].getNodesFiltered(node => this.nodeNames[chain].has(node.name));
    const result: NodeInfo[] = [];
    for (const node of nodes) {
      const nodeInfo = { ...node } as NodeInfo;

      if (node.networkInfo?.ip) {
        const ipInfo = await this.getLocationInfo(node.networkInfo.ip);
        nodeInfo.location = this.parseLocation(ipInfo);
      }

      result.push(nodeInfo);
    }

    return result;
  }
}
