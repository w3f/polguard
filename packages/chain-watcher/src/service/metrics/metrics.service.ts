import { Injectable, OnModuleInit } from '@nestjs/common';
import { Registry, collectDefaultMetrics, Gauge } from 'prom-client';
import { MetricsClient, Chain } from '@w3f/monitoring-types';

const prefix = 'mp_chain_watcher_';

@Injectable()
export class MetricsService implements OnModuleInit, MetricsClient {
  private readonly registry: Registry;
  private blockHeight: Gauge;

  constructor(
    private readonly network: Chain,
    private readonly environment: string,
  ) {
    this.registry = new Registry();

    this.blockHeight = new Gauge({
      name: `${prefix}block_height`,
      help: 'Current block height of the chain',
      labelNames: ['network', 'environment'],
      registers: [this.registry],
    });

    this.blockHeight.labels({ network: this.network, environment: this.environment });
  }

  onModuleInit() {
    collectDefaultMetrics({ register: this.registry, prefix: prefix });
  }

  setBlockHeight(height: number): void {
    this.blockHeight.set({ network: this.network, environment: this.environment }, height);
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }
}
