import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import { MonitoringConfigService } from '../monitoring-config/monitoring-config.service';
import { StorageService } from '../storage/storage.service';
import { getChainProperties } from '@w3f/monitoring-types';
import { TelemetryWatcher } from '../../lib/watcher';
import { IncidentHandler } from '../../lib/incident-handler';
import { IncidentApiService } from '../incident/incident-publisher.service';
import { TelemetryService } from '@service/telemetry/telemetry.service';

@Injectable()
export class WatcherService implements OnApplicationBootstrap, OnApplicationShutdown {
  private watcher: TelemetryWatcher;

  constructor(
    private readonly logger: Logger,
    private readonly config: ConfigService,
    private readonly monitoringConfig: MonitoringConfigService,
    private readonly storage: StorageService,
    private readonly incidents: IncidentApiService,
    private readonly telemetry: TelemetryService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.start();
  }

  async onApplicationShutdown(): Promise<void> {
    await this.watcher.stop();
  }

  private async start(): Promise<void> {
    const chain = this.config.getChain();
    const chainProps = getChainProperties(chain);
    const pollingIntervalMs = this.config.getPollingInterval();

    const incidentHandler = new IncidentHandler(this.logger, this.storage, this.incidents, chainProps.chain);

    this.watcher = new TelemetryWatcher(
      new Logger('TelemetryWatcher'),
      this.monitoringConfig,
      this.telemetry,
      incidentHandler,
      chainProps,
      pollingIntervalMs,
    );

    await this.watcher.start();
  }
}
