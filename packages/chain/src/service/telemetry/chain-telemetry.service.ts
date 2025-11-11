import { Injectable } from '@nestjs/common';
import { metrics, Meter, Gauge } from '@opentelemetry/api';
import { TELEMETRY_PREFIX } from '@w3f/monitoring-telemetry';
import { ChainTelemetryClient, MonitoringGroup } from '@w3f/monitoring-types';

@Injectable()
export class ChainTelemetryService implements ChainTelemetryClient {
  private readonly meter: Meter;
  private readonly latestBlockOnChain: Gauge;
  private readonly lastBlockProcessed: Gauge;
  private readonly currentBlockProcessing: Gauge;
  private readonly blockProcessingTime: Gauge;
  private readonly totalGroups: Gauge;
  private readonly totalAccounts: Gauge;
  private readonly totalMonitors: Gauge;

  constructor() {
    this.meter = metrics.getMeter(`${TELEMETRY_PREFIX}.monitoring-chain`);

    this.latestBlockOnChain = this.meter.createGauge(`${TELEMETRY_PREFIX}.monitoring-chain.latest-block-on-chain`, {
      description: "The chain's latest block, as reported by the RPC subscription.",
    });

    this.lastBlockProcessed = this.meter.createGauge(`${TELEMETRY_PREFIX}.monitoring-chain.last-block-processed`, {
      description: 'The last block that the chain-service has processed.',
    });

    this.currentBlockProcessing = this.meter.createGauge(
      `${TELEMETRY_PREFIX}.monitoring-chain.current-block-processing`,
      { description: 'The block that the chain-service is currently processing.' },
    );

    // This should be available via traces, if traces are enabled
    this.blockProcessingTime = this.meter.createGauge(`${TELEMETRY_PREFIX}.monitoring-chain.block-processing-time`, {
      description: 'The time it takes to process a block.',
      unit: 'ms',
    });

    this.totalGroups = this.meter.createGauge(`${TELEMETRY_PREFIX}.monitoring-chain.total-groups`, {
      description: 'The number of monitoring groups loaded for this chain.',
    });

    this.totalAccounts = this.meter.createGauge(`${TELEMETRY_PREFIX}.monitoring-chain.total-accounts`, {
      description: 'The number of accounts being monitored for this chain.',
    });

    this.totalMonitors = this.meter.createGauge(`${TELEMETRY_PREFIX}.monitoring-chain.total-monitors`, {
      description: 'The number of unique monitor types active for this chain.',
    });
  }

  recordLatestBlock(blockNumber: number): void {
    this.latestBlockOnChain.record(blockNumber);
  }

  recordProcessedBlock(blockNumber: number): void {
    this.lastBlockProcessed.record(blockNumber);
  }

  recordCurrentBlock(blockNumber: number): void {
    this.currentBlockProcessing.record(blockNumber);
  }

  recordProcessingTime(ms: number): void {
    this.blockProcessingTime.record(ms);
  }

  recordMonitoringConfig(groups: MonitoringGroup[]): void {
    this.totalGroups.record(groups.length);

    const accounts = new Set(groups.flatMap(g => g.accounts.map(a => a.ss58)));
    this.totalAccounts.record(accounts.size);

    const monitorTypes = new Set(groups.flatMap(g => g.monitors.map(m => m.name)));
    this.totalMonitors.record(monitorTypes.size);
  }
}
