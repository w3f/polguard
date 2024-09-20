import { Logger, Module, OnModuleInit } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ProcessedBlockModule } from './block-tracker/block-tracker.module';
import { AppService } from './app.service';
import { AppConfigService } from './config-services/app-config.service';
import { MonitoringConfigService } from './config-services/monitoring-config.service';
import { ConfigService } from './config-services/config.service';
import { ReconnectableApi } from '@core/polkadot-api/reconnectable-api';
import { EventDispatcherAdapter } from './event-dispatcher.adapter';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    ProcessedBlockModule,
  ],
  providers: [
    Logger,
    AppService,
    AppConfigService,
    MonitoringConfigService,
    ConfigService,
    {
      provide: ReconnectableApi,
      useFactory: (logger: Logger) => new ReconnectableApi(logger),
      inject: [Logger],
    },
    {
      provide: EventDispatcherAdapter,
      useFactory: (eventEmitter: EventEmitter2) => new EventDispatcherAdapter(eventEmitter),
      inject: [EventEmitter2],
    },
  ],
})
export class AppModule implements OnModuleInit {
  constructor(
    private monitoringConfigService: MonitoringConfigService,
    private reconnectableApi: ReconnectableApi,
    private configService: ConfigService,
  ) {}

  async onModuleInit() {
    await this.monitoringConfigService.initialize();
    const rpcs = this.configService.getRPCs();
    await this.reconnectableApi.connect(rpcs);
  }
}
