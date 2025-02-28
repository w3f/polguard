import { TelemetryHandler } from '../../common/decorators';
import { AbstractTelemetryMonitor } from '../abstract-telemetry-monitor';
import { MonitorType, Chain, TelemetryHandlerType as H, TelemetryHandlerParams } from '@w3f/monitoring-types';
import * as semver from 'semver';

export class TelemetryMonitor extends AbstractTelemetryMonitor<MonitorType.Telemetry> {
  @TelemetryHandler([Chain.Polkadot, Chain.Kusama])
  async locationUnexpected({ data }: TelemetryHandlerParams): Promise<void> {
    await this.forEachAccount(H.LocationUnexpected, async ({ account, alerts, groupId }) => {
      const { sanctionedCountries, sanctionedRegions } = account.settings;
      if (!sanctionedCountries && !sanctionedRegions) return;
      let details: string[] = [];

      for (const node of data[account.ss58] || []) {
        if (
          sanctionedCountries?.includes(node.geoLocation?.country) ||
          false ||
          sanctionedRegions?.includes(node.geoLocation?.region) ||
          false
        ) {
          details = [`${[node.geoLocation?.region, node.geoLocation?.country].filter(Boolean).join(', ')}`];
          break;
        }
      }

      const isFiring = details.length > 0;
      const message = this.createMessage([`${account.name} node detected in sanctioned location.`, ...details]);

      const key = `${account.ss58}:${groupId}:${H.LocationUnexpected}`;
      await this.incidents.ongoingIncident(message, alerts, key, isFiring);
    });
  }

  @TelemetryHandler([Chain.Polkadot, Chain.Kusama])
  async providerUnexpected({ data }: TelemetryHandlerParams): Promise<void> {
    await this.forEachAccount(H.ProviderUnexpected, async ({ account, alerts, groupId }) => {
      if (!account.settings.provider) return;
      let details: string[] = [];

      for (const node of data[account.ss58] || []) {
        const providerName = node.geoLocation?.asn?.name;
        if (providerName !== account.settings.provider) {
          details = [`Expected "${account.settings.provider}", got "${providerName}"`];
          break;
        }
      }

      const isFiring = details.length > 0;
      const message = this.createMessage([`${account.name} node running on unexpected provider.`, ...details]);

      const key = `${account.ss58}:${groupId}:${H.ProviderUnexpected}`;
      await this.incidents.ongoingIncident(message, alerts, key, isFiring);
    });
  }

  @TelemetryHandler([Chain.Polkadot, Chain.Kusama])
  async clientVersionOutdated({ data }: TelemetryHandlerParams): Promise<void> {
    await this.forEachAccount(H.VersionOutdated, async ({ account, alerts, groupId }) => {
      if (!account.settings.clientVersion) return;
      let details: string[] = [];

      for (const node of data[account.ss58] || []) {
        const expectedVersion = account.settings.clientVersion[node.implementation];
        const currentVersion = node.version.split('-')[0];
        if (!expectedVersion) {
          details = [`Unknown implementation "${node.implementation}"`];
          break;
        }

        const cleanExpected = semver.clean(expectedVersion);
        const cleanCurrent = semver.clean(currentVersion);
        if (!cleanExpected || !cleanCurrent) {
          details = [`Invalid version format. Expected: "${cleanExpected}", Current: "${currentVersion}"`];
          break;
        }

        if (semver.lt(cleanCurrent, cleanExpected)) {
          details = [`Version "${currentVersion}" is outdated. Expected version is "${cleanExpected}"`];
          break;
        }
      }

      const isFiring = details.length > 0;
      const message = this.createMessage([`${account.name} node client version issue detected.`, ...details]);

      const key = `${account.ss58}:${groupId}:${H.VersionOutdated}`;
      await this.incidents.ongoingIncident(message, alerts, key, isFiring);
    });
  }

  @TelemetryHandler([Chain.Polkadot, Chain.Kusama])
  async hardwareUnexpected({ data }: TelemetryHandlerParams): Promise<void> {
    await this.forEachAccount(H.HardwareUnexpected, async ({ account, alerts, groupId }) => {
      const { cpu, minMemoryGB, minCores } = account.settings;
      if (!cpu && !minMemoryGB && !minCores) return;
      const details: string[] = [];

      for (const node of data[account.ss58] || []) {
        const systemInfo = node.systemInfo!;
        const memoryGB = systemInfo.memory / (1024 * 1024 * 1024);

        if (cpu && systemInfo.cpu !== cpu) {
          details.push(`Expected CPU "${cpu}", got "${systemInfo.cpu}"`);
        }
        if (minMemoryGB && memoryGB < minMemoryGB) {
          details.push(`Expected memory "${minMemoryGB}GB", got "${memoryGB.toFixed(2)}GB"`);
        }
        if (minCores && systemInfo.coreCount < minCores) {
          details.push(`Expected cores "${minCores}", got "${systemInfo.coreCount}"`);
        }

        if (details.length > 0) break;
      }

      const isFiring = details.length > 0;
      const message = this.createMessage([`${account.name} node hardware requirements not met.`, ...details]);

      const key = `${account.ss58}:${groupId}:${H.HardwareUnexpected}`;
      await this.incidents.ongoingIncident(message, alerts, key, isFiring);
    });
  }

  @TelemetryHandler([Chain.Polkadot, Chain.Kusama])
  async ipSpoofing({ data }: TelemetryHandlerParams): Promise<void> {
    await this.forEachAccount(H.IpSpoofing, async ({ account, alerts, groupId }) => {
      let details: string[] = [];
      const ipv4Regex = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/;

      for (const node of data[account.ss58] || []) {
        const reportedIp = node?.networkInfo?.ip;
        if (!reportedIp || !node.peerDiscovery?.addresses) continue;

        const discoveredIps = node.peerDiscovery.addresses
          .map(addr => {
            const match = addr.multiaddr.match(ipv4Regex);
            return match ? match[0] : null;
          })
          .filter(Boolean);

        if (!discoveredIps.includes(reportedIp)) {
          details = [
            `Reported IP "${reportedIp}" not found in peer discovery addresses.`,
            `Discovered IPs: ${discoveredIps.join(', ')}`,
          ];
          break;
        }
      }

      const isFiring = details.length > 0;
      const message = this.createMessage([`${account.name} node potential IP spoofing detected.`, ...details]);

      const key = `${account.ss58}:${groupId}:${H.IpSpoofing}`;
      await this.incidents.ongoingIncident(message, alerts, key, isFiring);
    });
  }

  @TelemetryHandler([Chain.Polkadot, Chain.Kusama])
  async telemetryMissing({ data }: TelemetryHandlerParams): Promise<void> {
    await this.forEachAccount(H.TelemetryMissing, async ({ account, alerts, groupId }) => {
      const isFiring = !data[account.ss58] || data[account.ss58].length === 0;

      const message = this.createMessage([`${account.name} telemetry data not available.`]);

      const key = `${account.ss58}:${groupId}:${H.TelemetryMissing}`;
      // Use tolerant threshold as telemetry data can be noisy
      const threshold = this.getFiringThreshold('tolerant');
      await this.incidents.ongoingIncident(message, alerts, key, isFiring, undefined, threshold);
    });
  }
}
