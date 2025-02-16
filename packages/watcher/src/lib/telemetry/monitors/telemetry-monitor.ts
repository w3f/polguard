import { TelemetryHandler } from '../../common/decorators';
import { AbstractTelemetryMonitor } from '../abstract-telemetry-monitor';
import { MonitorType, Chain, TelemetryHandlerType as H, TelemetryHandlerParams } from '@w3f/monitoring-types';

export class TelemetryMonitor extends AbstractTelemetryMonitor<MonitorType.Telemetry> {
  @TelemetryHandler([Chain.Polkadot, Chain.Kusama])
  async locationUnexpected({ data }: TelemetryHandlerParams): Promise<void> {
    await this.forEachNode(H.LocationUnexpected, data, async ({ node, account, alerts, groupId }) => {
      const { sanctionedCountries, sanctionedRegions } = account.settings;
      if (!sanctionedCountries && !sanctionedRegions) return;

      const isSanctioned =
        (sanctionedCountries?.includes(node.ipinfo?.country) || false) ||
        (sanctionedRegions?.includes(node.ipinfo?.region) || false);

      const message = this.createMessage([
        `${account.name} node detected in sanctioned location.`,
        `${[node.ipinfo?.region, node.ipinfo?.country].filter(Boolean).join(', ')}`,
      ]);

      const key = `${account.ss58}:${groupId}:${node.id}:${H.LocationUnexpected}`;
      await this.incidents.ongoingIncident(message, alerts, key, isSanctioned);
    });
  }

  @TelemetryHandler([Chain.Polkadot, Chain.Kusama])
  async providerUnexpected({ data }: TelemetryHandlerParams): Promise<void> {
    await this.forEachNode(H.ProviderUnexpected, data, async ({ node, account, alerts, groupId }) => {
      if (!account.settings.provider) return;

      const providerName = node.ipinfo?.asn?.name;
      const isFiring = providerName !== account.settings.provider;

      const message = this.createMessage([
        `${account.name} node running on unexpected provider.`,
        `Expected "${account.settings.provider}", got "${providerName}"`,
      ]);

      const key = `${account.ss58}:${groupId}:${node.id}:${H.ProviderUnexpected}`;
      await this.incidents.ongoingIncident(message, alerts, key, isFiring);
    });
  }

  @TelemetryHandler([Chain.Polkadot, Chain.Kusama])
  async clientVersionOutdated({ data }: TelemetryHandlerParams): Promise<void> {
    await this.forEachNode(H.VersionOutdated, data, async ({ node, account, alerts, groupId }) => {
      if (!account.settings.clientVersion) return;

      const latestVersion = account.settings.clientVersion[node.implementation];
      const currentVersion = node.version.split('-')[0];
      const isFiring = !latestVersion || currentVersion !== latestVersion;

      const message = this.createMessage([
        `${account.name} node client version issue detected.`,
        !latestVersion
          ? `Unknown implementation "${node.implementation}"`
          : `Expected "${latestVersion}", got "${currentVersion}"`,
      ]);

      const key = `${account.ss58}:${groupId}:${node.id}:${H.VersionOutdated}`;
      await this.incidents.ongoingIncident(message, alerts, key, isFiring);
    });
  }

  @TelemetryHandler([Chain.Polkadot, Chain.Kusama])
  async hardwareUnexpected({ data }: TelemetryHandlerParams): Promise<void> {
    await this.forEachNode(H.HardwareUnexpected, data, async ({ node, account, alerts, groupId }) => {
      const { cpu, minMemoryGB, minCores } = account.settings;
      if (!cpu && !minMemoryGB && !minCores) return;

      const systemInfo = node.systemInfo!;
      const memoryGB = systemInfo.memory / (1024 * 1024 * 1024);
      const issues: string[] = [];
      let isFiring = false;

      if (cpu) {
        const isCpuMismatch = systemInfo.cpu !== cpu;
        if (isCpuMismatch) {
          issues.push(`Expected CPU "${cpu}", got "${systemInfo.cpu}"`);
          isFiring = true;
        }
      }

      if (minMemoryGB) {
        const isMemoryInsufficient = memoryGB < minMemoryGB;
        if (isMemoryInsufficient) {
          issues.push(`Expected memory "${minMemoryGB}GB", got "${memoryGB.toFixed(2)}GB"`);
          isFiring = true;
        }
      }

      if (minCores) {
        const isCoresInsufficient = systemInfo.coreCount < minCores;
        if (isCoresInsufficient) {
          issues.push(`Expected cores "${minCores}", got "${systemInfo.coreCount}"`);
          isFiring = true;
        }
      }

      const message = this.createMessage(
        [
          `${account.name} node hardware requirements not met.`,
          ...issues
        ]
      );

      const key = `${account.ss58}:${groupId}:${node.id}:${H.HardwareUnexpected}`;
      await this.incidents.ongoingIncident(message, alerts, key, isFiring);
    });
  }

  @TelemetryHandler([Chain.Polkadot, Chain.Kusama])
  async ipSpoofing({ data }: TelemetryHandlerParams): Promise<void> {
    await this.forEachNode(H.IpSpoofing, data, async ({ node, account, alerts, groupId }) => {
      const reportedIp = node?.networkInfo?.ip;
      if (!reportedIp || !node.peerDiscovery?.addresses) return;

      const ipv4Regex = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/;
      const discoveredIps = node.peerDiscovery.addresses
        .map(addr => {
          const match = addr.multiaddr.match(ipv4Regex);
          return match ? match[0] : null;
        })
        .filter(Boolean);

      const ipVerified = discoveredIps.includes(reportedIp);
      const isFiring = !ipVerified;

      const message = this.createMessage([
        `${account.name} node potential IP spoofing detected.`,
        `Reported IP "${reportedIp}" not found in peer discovery addresses.`,
        `Discovered IPs: ${discoveredIps.join(', ')}`
      ]);

      const key = `${account.ss58}:${groupId}:${node.id}:${H.IpSpoofing}`;
      await this.incidents.ongoingIncident(message, alerts, key, isFiring);
    });
  }

  @TelemetryHandler([Chain.Polkadot, Chain.Kusama])
  async telemetryMissing({ data }: TelemetryHandlerParams): Promise<void> {
    await this.forEachAccount(H.TelemetryMissing, async ({ account, alerts, groupId }) => {
      const isFiring = !data[account.ss58] || data[account.ss58].length === 0;

      const message = this.createMessage([`${account.name} telemetry data not available.`]);

      const key = `${account.ss58}:${groupId}:${H.TelemetryMissing}`;
      await this.incidents.ongoingIncident(message, alerts, key, isFiring);
    });
  }
}
