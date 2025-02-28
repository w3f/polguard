export type GenesisHash = string;
export type NodeId = number;
export type NodeName = string;
export type NodeImplementation = string;
export type NodeVersion = string;
export type BlockNumber = number;
export type BlockHash = string;
export type Timestamp = number;
export type PropagationTime = number;
export type NetworkId = string;

export interface TelemetryData {
  polkadot?: NodeInfo[];
  kusama?: NodeInfo[];
}

export interface NodeSystemInfo {
  cpu: string;
  memory: number;  // in bytes
  coreCount: number;
  isVirtualMachine: boolean;
  kernel?: string;      // Linux kernel version
  distribution?: string; // Linux distribution
  targetOS?: string;    // Operating system target
  targetArch?: string;  // CPU architecture target
  targetEnv?: string;   // Environment target
}

export interface NodeNetworkInfo {
  ipv4?: string;
  ipv6?: string;
  peerId?: string;     // libp2p peer id
  peerCount: number;
  ip?: string;         // Raw IP from backend if exposed
}

export interface NodeLocation {
  latitude?: number;
  longitude?: number;
  city?: string;
}

export interface NodeBlock {
  height: number;
  hash: string;
  propagationTime?: number;
  finalized?: number;
  finalizedHash?: string;
}

export interface BaseNodeInfo {
  id: NodeId;
  name: NodeName;
  implementation: NodeImplementation;
  version: NodeVersion;
  validator?: string;
  networkInfo: NodeNetworkInfo;
  systemInfo?: NodeSystemInfo;
  location?: NodeLocation;
  block?: NodeBlock;
  transactionCount?: number;
  startupTime?: Timestamp;
  stale?: boolean;
  updatedAt: string;  // ISO UTC timestamp
}

export interface IpInfoAsn {
  asn: string;
  name: string;
  domain: string;
  route: string;
  type: string;
}

export interface IpInfoPrivacy {
  vpn: boolean;
  proxy: boolean;
  tor: boolean;
  relay: boolean;
  hosting: boolean;
  service: string;
}

export interface GeoLocationMetadata {
  ip: string;
  hostname?: string;
  city?: string;
  region?: string;
  country?: string;
  loc?: string;
  postal?: string;
  timezone?: string;
  asn?: IpInfoAsn;
  privacy?: IpInfoPrivacy;
  updatedAt?: string;  // ISO UTC timestamp
}

export interface PeerAddress {
  multiaddr: string;
  lastSeen: string; // ISO UTC timestamp
}

export interface PeerDiscoveryMetadata {
  peerId: string;
  addresses: PeerAddress[];
  updatedAt: string; // ISO UTC timestamp
}

export interface NodeInfo extends BaseNodeInfo {
  geoLocation?: GeoLocationMetadata;
  peerDiscovery?: PeerDiscoveryMetadata;
  config?: {
    stash: string;
  };
}

export type Nodes = Record<string, NodeInfo[]>;
