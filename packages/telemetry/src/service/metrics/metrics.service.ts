import { Injectable, OnModuleInit } from '@nestjs/common';
import { Registry, collectDefaultMetrics, Gauge } from 'prom-client';
import { MetricsClient, Chain } from '@w3f/monitoring-types';

const prefix = 'mp_chain_watcher_';

@Injectable()
export class MetricsService implements OnModuleInit, MetricsClient {
  private readonly registry: Registry;
  private accountsCount: Gauge;
  private monitorsCount: Gauge;
  private groupsCount: Gauge;

  constructor(
    private readonly network: Chain,
    private readonly environment: string,
  ) {
    this.registry = new Registry();

    this.accountsCount = new Gauge({
      name: `${prefix}accounts_total`,
      help: 'Total number of accounts being monitored',
      labelNames: ['network', 'environment'],
      registers: [this.registry],
    });

    this.monitorsCount = new Gauge({
      name: `${prefix}monitors_total`,
      help: 'Total number of active monitors',
      labelNames: ['network', 'environment'],
      registers: [this.registry],
    });

    this.groupsCount = new Gauge({
      name: `${prefix}groups_total`,
      help: 'Total number of monitoring groups',
      labelNames: ['network', 'environment'],
      registers: [this.registry],
    });

    const labels = { network: this.network, environment: this.environment };
    this.accountsCount.labels(labels);
    this.monitorsCount.labels(labels);
    this.groupsCount.labels(labels);
  }

  onModuleInit() {
    collectDefaultMetrics({ register: this.registry, prefix: prefix });
  }

  setMonitoredAccountsCount(count: number): void {
    this.accountsCount.set({ network: this.network, environment: this.environment }, count);
  }

  setMonitorsCount(count: number): void {
    this.monitorsCount.set({ network: this.network, environment: this.environment }, count);
  }

  setMonitorGroupsCount(count: number): void {
    this.groupsCount.set({ network: this.network, environment: this.environment }, count);
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }
}
