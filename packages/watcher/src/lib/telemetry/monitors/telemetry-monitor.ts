// TODO: The whole Telemetry feature is going to be removed in the future

import { Telemetry, IncidentPayload } from '../../common/decorators';
import { AbstractTelemetryMonitor } from '../abstract-telemetry-monitor';
import { MonitorType, Chain, TelemetryHandlerType as H, TelemetryHandlerParams } from '@w3f/monitoring-types';
import * as semver from 'semver';

export class TelemetryMonitor extends AbstractTelemetryMonitor<MonitorType.Telemetry> {
  @Telemetry(H.LocationUnexpected, [Chain.Polkadot, Chain.Kusama])
  async locationUnexpected({
    data,
    handler,
  }: TelemetryHandlerParams<H.LocationUnexpected>): Promise<IncidentPayload[]> {
    const incidents: IncidentPayload[] = [];

    await this.forEachAccount(handler, async ({ account, alerts, groupId }) => {
      if (!data[account.ss58]) return;
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
      const message = [`${account.name} node detected in sanctioned location.`, ...details];
      const key = { wallet: account.ss58, groupId, handler };
      incidents.push({ message, alerts, key, blockNumber: 0, isFiring });
    });

    return incidents;
  }

  @Telemetry(H.ProviderUnexpected, [Chain.Polkadot, Chain.Kusama])
  async providerUnexpected({
    data,
    handler,
  }: TelemetryHandlerParams<H.ProviderUnexpected>): Promise<IncidentPayload[]> {
    const incidents: IncidentPayload[] = [];

    await this.forEachAccount(handler, async ({ account, alerts, groupId }) => {
      if (!data[account.ss58]) return;
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
      const message = [`${account.name} node running on unexpected provider.`, ...details];
      const key = { wallet: account.ss58, groupId, handler };
      incidents.push({ message, alerts, key, blockNumber: 0, isFiring });
    });

    return incidents;
  }

  @Telemetry(H.VersionOutdated, [Chain.Polkadot, Chain.Kusama])
  async clientVersionOutdated({
    data,
    handler,
  }: TelemetryHandlerParams<H.VersionOutdated>): Promise<IncidentPayload[]> {
    const incidents: IncidentPayload[] = [];

    await this.forEachAccount(handler, async ({ account, alerts, groupId }) => {
      if (!data[account.ss58]) return;
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
      const message = [`${account.name} node client version issue detected.`, ...details];
      const key = { wallet: account.ss58, groupId, handler };
      incidents.push({ message, alerts, key, blockNumber: 0, isFiring });
    });

    return incidents;
  }

  @Telemetry(H.HardwareUnexpected, [Chain.Polkadot, Chain.Kusama])
  async hardwareUnexpected({
    data,
    handler,
  }: TelemetryHandlerParams<H.HardwareUnexpected>): Promise<IncidentPayload[]> {
    const incidents: IncidentPayload[] = [];

    await this.forEachAccount(handler, async ({ account, alerts, groupId }) => {
      if (!data[account.ss58]) return;
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
      const message = [`${account.name} node hardware requirements not met.`, ...details];
      const key = { wallet: account.ss58, groupId, handler };
      incidents.push({ message, alerts, key, blockNumber: 0, isFiring });
    });

    return incidents;
  }

  @Telemetry(H.IpSpoofing, [Chain.Polkadot, Chain.Kusama])
  async ipSpoofing({ data, handler }: TelemetryHandlerParams<H.IpSpoofing>): Promise<IncidentPayload[]> {
    const incidents: IncidentPayload[] = [];

    await this.forEachAccount(handler, async ({ account, alerts, groupId }) => {
      if (!data[account.ss58]) return;
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
      const message = [`${account.name} node potential IP spoofing detected.`, ...details];
      const key = { wallet: account.ss58, groupId, handler };
      incidents.push({ message, alerts, key, blockNumber: 0, isFiring });
    });

    return incidents;
  }

  @Telemetry(H.TelemetryMissing, [Chain.Polkadot, Chain.Kusama])
  async telemetryMissing({ data, handler }: TelemetryHandlerParams<H.TelemetryMissing>): Promise<IncidentPayload[]> {
    const incidents: IncidentPayload[] = [];

    await this.forEachAccount(handler, async ({ account, alerts, groupId }) => {
      const isFiring = !data[account.ss58] || data[account.ss58].length === 0;
      const message = [`${account.name} telemetry data not available.`];
      const key = { wallet: account.ss58, groupId, handler };
      incidents.push({ message, alerts, key, blockNumber: 0, isFiring });
    });

    return incidents;
  }
}
