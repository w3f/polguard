import { Injectable, OnModuleInit } from '@nestjs/common';
import { Registry, collectDefaultMetrics } from 'prom-client';

@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly registry: Registry;

  constructor() {
    this.registry = new Registry();
  }

  onModuleInit() {
    collectDefaultMetrics({ register: this.registry });
  }

  // TODO: Add ChainWatcher metrics

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }
}
