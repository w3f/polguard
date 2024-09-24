import { Logger, Module, OnModuleInit } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ProcessedBlockModule } from './block-tracker/block-tracker.module';
import { AppService } from './app.service';
import { ReconnectableApi } from '@core/api/reconnectable-api';
import { EventDispatcherAdapter } from './event-dispatcher.adapter';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { HealthModule } from './health/health.module';
import { MetricsModule } from './metrics/metrics.module';
import { ConfigModule } from './config/config.module';
import { ConfigService } from './config/config.service';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    ProcessedBlockModule,
    HealthModule,
    MetricsModule,
    ConfigModule,
  ],
  providers: [
    Logger,
    AppService,
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
    private reconnectableApi: ReconnectableApi,
    private configService: ConfigService,
  ) {}

  async onModuleInit() {
    const rpcs = this.configService.getRPCs();
    await this.reconnectableApi.connect(rpcs);
  }
}
