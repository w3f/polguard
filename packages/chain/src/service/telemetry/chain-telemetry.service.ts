import { metrics, Meter, Gauge } from '@opentelemetry/api';
import { ChainTelemetryClient, MonitoringGroup, TELEMETRY_PREFIX } from '../../types';

export class ChainTelemetryService implements ChainTelemetryClient {
  private readonly meter: Meter;
  private readonly latestBlockOnChain: Gauge;
  private readonly lastBlockProcessed: Gauge;
  private readonly currentBlockProcessing: Gauge;
  private readonly blockProcessingTime: Gauge;
  private readonly totalGroups: Gauge;
  private readonly totalAccounts: Gauge;
  private readonly totalMonitors: Gauge;
  private readonly chainName: string;

  constructor(chainName: string) {
    this.chainName = chainName;
    this.meter = metrics.getMeter(`${TELEMETRY_PREFIX}.chain`);

    this.latestBlockOnChain = this.meter.createGauge(`${TELEMETRY_PREFIX}.chain.latest-block-on-chain`, {
      description: "The chain's latest block, as reported by the RPC subscription.",
    });

    this.lastBlockProcessed = this.meter.createGauge(`${TELEMETRY_PREFIX}.chain.last-block-processed`, {
      description: 'The last block that the chain-service has processed.',
    });

    this.currentBlockProcessing = this.meter.createGauge(`${TELEMETRY_PREFIX}.chain.current-block-processing`, {
      description: 'The block that the chain-service is currently processing.',
    });

    this.blockProcessingTime = this.meter.createGauge(`${TELEMETRY_PREFIX}.chain.block-processing-time`, {
      description: 'The time it takes to process a block.',
      unit: 'ms',
    });

    this.totalGroups = this.meter.createGauge(`${TELEMETRY_PREFIX}.chain.total-groups`, {
      description: 'The number of monitoring groups loaded for this chain.',
    });

    this.totalAccounts = this.meter.createGauge(`${TELEMETRY_PREFIX}.chain.total-accounts`, {
      description: 'The number of accounts being monitored for this chain.',
    });

    this.totalMonitors = this.meter.createGauge(`${TELEMETRY_PREFIX}.chain.total-monitors`, {
      description: 'The number of unique monitor types active for this chain.',
    });
  }

  recordLatestBlock(blockNumber: number): void {
    this.latestBlockOnChain.record(blockNumber, { chain: this.chainName });
  }

  recordProcessedBlock(blockNumber: number): void {
    this.lastBlockProcessed.record(blockNumber, { chain: this.chainName });
  }

  recordCurrentBlock(blockNumber: number): void {
    this.currentBlockProcessing.record(blockNumber, { chain: this.chainName });
  }

  recordProcessingTime(ms: number): void {
    this.blockProcessingTime.record(ms, { chain: this.chainName });
  }

  recordMonitoringConfig(groups: MonitoringGroup[]): void {
    this.totalGroups.record(groups.length, { chain: this.chainName });

    const accounts = new Set(groups.flatMap(g => g.accounts.map(a => a.ss58)));
    this.totalAccounts.record(accounts.size, { chain: this.chainName });

    const monitorTypes = new Set(groups.flatMap(g => g.monitors.map(m => m.name)));
    this.totalMonitors.record(monitorTypes.size, { chain: this.chainName });
  }
}
