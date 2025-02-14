import { TelemetryHandler } from '../../common/decorators';
import { AbstractTelemetryMonitor } from '../abstract-telemetry-monitor';
import { MonitorType, Chain, TelemetryHandlerType as H, TelemetryHandlerParams } from '@w3f/monitoring-types';

export class TelemetryMonitor extends AbstractTelemetryMonitor<MonitorType.Telemetry> {
  @TelemetryHandler([Chain.Polkadot, Chain.Kusama])
  async locationUnexpected({ data }: TelemetryHandlerParams): Promise<void> {
    await this.forEachNode(H.LocationUnexpected, data, async ({ node, account, alerts, groupId }) => {
      if (!account.settings.location) return;

      const isSanctioned =
        account.settings.location.sanctionedCountries.includes(node.ipinfo?.country) ||
        account.settings.location.sanctionedRegions.includes(node.ipinfo?.region);

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
      if (!account.settings.hardware) return;

      const systemInfo = node.systemInfo!;
      const memoryGB = systemInfo.memory / (1024 * 1024 * 1024);

      const isCpuMismatch = systemInfo.cpu !== account.settings.hardware.cpu;
      const isMemoryInsufficient = memoryGB < account.settings.hardware.minMemoryGB;
      const isCoresInsufficient = systemInfo.coreCount < account.settings.hardware.minCores;
      const isFiring = isCpuMismatch || isMemoryInsufficient || isCoresInsufficient;

      const message = this.createMessage(
        [
          `${account.name} node hardware requirements not met.`,
          isCpuMismatch ? `Expected CPU "${account.settings.hardware.cpu}", got "${systemInfo.cpu}"` : null,
          isMemoryInsufficient
            ? `Expected memory "${account.settings.hardware.minMemoryGB}GB", got "${memoryGB.toFixed(2)}GB"`
            : null,
          isCoresInsufficient
            ? `Expected cores "${account.settings.hardware.minCores}", got "${systemInfo.coreCount}"`
            : null,
        ].filter(Boolean),
      );

      const key = `${account.ss58}:${groupId}:${node.id}:${H.HardwareUnexpected}`;
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
