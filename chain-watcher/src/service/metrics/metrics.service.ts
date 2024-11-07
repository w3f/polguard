import { Injectable, OnModuleInit } from '@nestjs/common';
import { Registry, collectDefaultMetrics, Gauge } from 'prom-client';
import { ChainWatcherMetrics } from '@lib/interfaces';
import { Chain } from '@lib/constants';

@Injectable()
export class MetricsService implements OnModuleInit, ChainWatcherMetrics {
  private readonly registry: Registry;
  private blockHeight: Gauge;

  constructor(
    private readonly network: Chain,
    private readonly environment: string
  ) {
    this.registry = new Registry();
    
    this.blockHeight = new Gauge({
      name: 'block_height',
      help: 'Current block height of the chain',
      labelNames: ['network', 'environment'],
      registers: [this.registry],
    });

    this.blockHeight.labels({ network: this.network, environment: this.environment });
  }

  onModuleInit() {
    collectDefaultMetrics({ register: this.registry });
  }

  setBlockHeight(height: number): void {
    this.blockHeight.set(height);
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }
}
